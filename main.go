//go:generate statik -src=./static

package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
	_ "github.com/pilosa/demo-taxi/statik"
	pilosa "github.com/pilosa/go-pilosa"
	"github.com/rakyll/statik/fs"
	"github.com/spf13/pflag"
)

const host = ":10101"
const indexName = "taxi"
const percentThreshold = 95

func main() {
	pilosaAddr := pflag.String("pilosa", "localhost:10101", "host:port for pilosa")
	pflag.Parse()

	server, err := NewServer(*pilosaAddr)
	if err != nil {
		log.Fatalf("getting new server: %v", err)
	}
	//server.testQuery()
	fmt.Printf("ride count: %d\n", server.NumRides)
	server.Serve()
}

type Server struct {
	Router   *mux.Router
	Client   *pilosa.Client
	Index    *pilosa.Index
	Frames   map[string]*pilosa.Frame
	NumRides uint64
}

func NewServer(pilosaAddr string) (*Server, error) {
	server := &Server{
		Frames: make(map[string]*pilosa.Frame),
	}

	router := mux.NewRouter()
	router.HandleFunc("/", server.HandleStatic).Methods("GET")
	router.HandleFunc("/assets/{file}", server.HandleStatic).Methods("GET")
	router.HandleFunc("/query/intersect", server.HandleIntersect).Methods("GET")
	router.HandleFunc("/query/topn", server.HandleTopN).Methods("GET")
	router.HandleFunc("/predefined/1", server.HandlePredefined1).Methods("GET")
	router.HandleFunc("/predefined/2", server.HandlePredefined2).Methods("GET")
	router.HandleFunc("/predefined/3", server.HandlePredefined3).Methods("GET")
	router.HandleFunc("/predefined/4", server.HandlePredefined4).Methods("GET")
	router.HandleFunc("/predefined/5", server.HandlePredefined5).Methods("GET")

	pilosaURI, err := pilosa.NewURIFromAddress(pilosaAddr)
	if err != nil {
		return nil, err
	}
	client := pilosa.NewClientWithURI(pilosaURI)
	index, err := pilosa.NewIndex(indexName, nil)
	if err != nil {
		return nil, fmt.Errorf("pilosa.NewIndex: %v", err)
	}
	err = client.EnsureIndex(index)
	if err != nil {
		return nil, fmt.Errorf("client.EnsureIndex: %v", err)
	}

	frames := []string{"cab_type", "passenger_count", "total_amount_dollars", "pickup_time", "pickup_day", "pickup_month", "pickup_year", "drop_time", "drop_day", "drop_month", "drop_year", "dist_miles", "duration_minutes", "speed_mph", "pickup_grid_id", "drop_grid_id"}

	for _, frameName := range frames {
		frame, err := index.Frame(frameName, nil)
		if err != nil {
			return nil, fmt.Errorf("index.Frame %v: %v", frameName, err)
		}
		err = client.EnsureFrame(frame)
		if err != nil {
			return nil, fmt.Errorf("client.EnsureFrame %v: %v", frameName, err)
		}

		server.Frames[frameName] = frame
	}

	server.Router = router
	server.Client = client
	server.Index = index
	server.NumRides = server.getRideCount()
	return server, nil
}

func (s *Server) testQuery() error {
	// Send a Bitmap query. PilosaException is thrown if execution of the query fails.
	response, err := s.Client.Query(s.Frames["pickup_year"].Bitmap(2013), nil)
	if err != nil {
		return fmt.Errorf("s.Client.Query: %v", err)
	}

	// Get the result
	result := response.Result()
	// Act on the result
	if result != nil {
		bits := result.Bitmap.Bits
		fmt.Printf("Got bits: %v\n", bits)
	}
	return nil
}

func (s *Server) Serve() {
	fmt.Println("running at localhost:8000")
	log.Fatal(http.ListenAndServe(":8000", s.Router))
}

func (s *Server) HandleStatic(w http.ResponseWriter, r *http.Request) {
	log.Println("handling")
	statikFS, err := fs.New()
	if err != nil {
		errorText := "Static assets missing. Run `go generate`"
		http.Error(w, errorText, http.StatusInternalServerError)
		log.Println(errorText)
		return
	}
	http.FileServer(statikFS).ServeHTTP(w, r)
}

func (s *Server) HandleIntersect(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	bitmaps := make([]*pilosa.PQLBitmapQuery, 0, 5)
	bitmapHTML := make([]string, 0, 5)
	for frame, id := range r.URL.Query() {
		if id[0] == "Green" {
			id[0] = "0"
		} else if id[0] == "Yellow" {
			id[0] = "1"
		}
		rowID, err := strconv.Atoi(id[0])
		if id[0] == "" || err != nil {
			continue
		}
		bitmaps = append(bitmaps, s.Frames[frame].Bitmap(uint64(rowID)))
		bitmapHTML = append(bitmapHTML, fmt.Sprintf("Bitmap(frame=%s, rowID=%d)", frame, rowID))
	}
	formattedQuery := fmt.Sprintf("Count(Intersect(<br />&nbsp;&nbsp;%s<br />))", strings.Join(bitmapHTML, ",<br />&nbsp;&nbsp;"))

	var q pilosa.PQLQuery
	if len(bitmaps) == 0 {
		log.Printf("need at least one bitmap for intersect\n")
		return
	} else if len(bitmaps) == 1 {
		q = s.Index.Count(bitmaps[0])
	} else {
		q = s.Index.Count(s.Index.Intersect(bitmaps[0], bitmaps[1], bitmaps[2:]...))
	}
	response, err := s.Client.Query(q, nil)

	dif := time.Since(start)

	resp := intersectResponse{}
	resp.NumRides = s.NumRides
	resp.Seconds = float64(dif.Seconds())
	resp.Query = formattedQuery
	resp.Rows = []intersectRow{intersectRow{response.Result().Count}}

	enc := json.NewEncoder(w)
	err = enc.Encode(resp)
	if err != nil {
		log.Printf("writing results: %v to responsewriter: %v", resp, err)
	}
}

type intersectResponse struct {
	Rows     []intersectRow `json:"rows"`
	Query    string         `json:"query"`
	Seconds  float64        `json:"seconds"`
	NumRides uint64         `json:"numProfiles"`
}

type intersectRow struct {
	Count uint64 `json:"count"`
}

var maxIDMap map[string]uint64 = map[string]uint64{
	"speed_mph":            100,
	"duration_minutes":     100,
	"dist_miles":           40,
	"total_amount_dollars": 100,
}

func (s *Server) HandleTopN(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	frame := r.URL.Query()["frame"][0]
	q := s.Frames[frame].TopN(0)

	response, err := s.Client.Query(q, nil)

	dif := time.Since(start)

	if frame == "pickup_grid_id" {
		resp := topNGridResponse{}
		resp.NumRides = s.NumRides
		resp.Description = "Pickup Locations"
		resp.Seconds = float64(dif.Seconds())
		for _, c := range response.Result().CountItems {
			x := c.ID % 100
			y := c.ID / 100
			resp.Rows = append(resp.Rows, topNGridRow{c.ID, c.Count, x, y})
		}
		enc := json.NewEncoder(w)
		err = enc.Encode(resp)
		if err != nil {
			log.Printf("writing results: %v to responsewriter: %v", resp, err)
		}
	} else {
		resp := topnResponse{}
		resp.Rows = make([]topnRow, 0, 50)
		resp.NumRides = s.NumRides
		resp.Seconds = float64(dif.Seconds())
		resp.Query = fmt.Sprintf("TopN(frame=%s)", frame)

		maxID := maxIDMap[frame]
		if maxID == 0 {
			maxID = 1000000
		}
		for _, ci := range response.Result().CountItems {
			if ci.ID > maxID {
				continue
			}
			resp.Rows = append(resp.Rows, topnRow{ci.ID, ci.Count})
		}
		enc := json.NewEncoder(w)
		err = enc.Encode(resp)
		if err != nil {
			log.Printf("writing results: %v to responsewriter: %v", resp, err)
		}
	}

}

type topNGridResponse struct {
	NumRides    uint64        `json:"numProfiles"`
	Description string        `json:"description"`
	Seconds     float64       `json:"seconds"`
	Rows        []topNGridRow `json:"rows"`
}

type topNGridRow struct {
	PickupGridID uint64 `json:"bitmapID"`
	Count        uint64 `json:"count"`
	X            uint64 `json:"x"`
	Y            uint64 `json:"y"`
}

type topnResponse struct {
	Rows     []topnRow `json:"rows"`
	Query    string    `json:"query"`
	Seconds  float64   `json:"seconds"`
	NumRides uint64    `json:"numProfiles"`
}

type topnRow struct {
	RowId uint64 `json:"bitmapID"`
	Count uint64 `json:"count"`
}

func (s *Server) HandlePredefined1(w http.ResponseWriter, r *http.Request) {
	// N queries, N = cardinality of cab_type (3) - lowest priority
	start := time.Now()

	q := s.Frames["cab_type"].TopN(5)
	response, err := s.Client.Query(q, nil)
	if err != nil {
		log.Printf("query %v failed with: %v", q, err)
	}

	resp := predefined1Response{}
	resp.Seconds = time.Now().Sub(start).Seconds()
	resp.Description = "Profile count by cab type (Mark #1)"
	resp.NumRides = s.NumRides

	resp.Rows = make([]predefined1Row, 0, 5)
	for _, c := range response.Result().CountItems {
		resp.Rows = append(resp.Rows, predefined1Row{c.ID, c.Count})
	}
	fmt.Printf("%+v\n", resp)

	enc := json.NewEncoder(w)
	err = enc.Encode(resp)
	if err != nil {
		log.Printf("writing results: %v to responsewriter: %v", resp, err)
	}
}

type predefined1Response struct {
	Rows        []predefined1Row `json:"rows"`
	Description string           `json:"description"`
	Seconds     float64          `json:"seconds"`
	NumRides    uint64           `json:"numProfiles"`
}

type predefined1Row struct {
	CabType uint64 `json:"cab_type"`
	Count   uint64 `json:"count"`
}

func (s *Server) HandlePredefined2(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	var wg = &sync.WaitGroup{}
	maxpcount := 8
	resp := predefined2Response{}
	arr := make([]float64, maxpcount+1)
	for pcount := 1; pcount <= maxpcount; pcount++ {
		wg.Add(1)
		go s.avgCostForPassengerCount(pcount, arr, wg)
	}
	wg.Wait()
	resp.Seconds = time.Since(start).Seconds()
	resp.NumRides = s.NumRides
	resp.Description = "average(total_amount) by passenger_count (Mark #2)"
	resp.Rows = make([]predefined2Row, 0, maxpcount)
	for id, amt := range arr {
		resp.Rows = append(resp.Rows, predefined2Row{uint64(id), amt})
	}

	enc := json.NewEncoder(w)
	err := enc.Encode(resp)
	if err != nil {
		log.Printf("writing results: %v to responsewriter: %v", resp, err)
	}
}

type predefined2Response struct {
	Rows        []predefined2Row `json:"rows"`
	Description string           `json:"description"`
	Seconds     float64          `json:"seconds"`
	NumRides    uint64           `json:"numProfiles"`
}

type predefined2Row struct {
	PassengerCount uint64  `json:"passengerCount"`
	AverageAmount  float64 `json:"average(totalAmount)"`
}

func (s *Server) avgCostForPassengerCount(count int, values []float64, wg *sync.WaitGroup) {
	defer wg.Done()
	// TopN(frame=total_amount_dollars, Bitmap(frame=passenger_count, rowID=pcount))
	// for each $ amount, add amnt*num_rides to total amount and add num_rides to total rides.
	// now just calc avg
	tadFrame, ok := s.Frames["total_amount_dollars"]
	if !ok {
		log.Println("total_amount_dollars frame doesn't exist")
	}
	pcFrame, ok := s.Frames["passenger_count"]
	if !ok {
		log.Println("passenger_count frame doesn't exist")
	}
	pcBitmap := pcFrame.Bitmap(uint64(count))
	query := tadFrame.BitmapTopN(1000, pcBitmap)
	qtime := time.Now()
	results, err := s.Client.Query(query, nil)
	log.Printf("query time for passenger count: %v is %v", count, time.Since(qtime).Seconds())
	if err != nil {
		log.Printf("query %v failed with: %v", query, err)
		return
	}
	var num_rides uint64 = 0
	var total_amount uint64 = 0
	for _, cri := range results.Results()[0].CountItems {
		num_rides += cri.Count
		total_amount += cri.ID * cri.Count
	}
	values[count] = float64(total_amount) / float64(num_rides)
}

func (s *Server) HandlePredefined3(w http.ResponseWriter, r *http.Request) {
	// NxM queries, N, M = cardinality of passenger_count (8), year (7) - medium priority
	t := time.Now()
	resp := predefined3Response{}
	resp.Rows = make([]predefined3Row, 0, 56)
	rowChan := make(chan predefined3Row, 56)
	var wg = &sync.WaitGroup{}

	for year := 2009; year <= 2016; year++ {
		wg.Add(1)
		go s.pcountTopNPerYear(year, rowChan, wg)
	}
	go func() {
		wg.Wait()
		close(rowChan)
	}()
	for row := range rowChan {
		fmt.Println(row)
		resp.Rows = append(resp.Rows, row)
	}
	dif := time.Since(t)

	resp.NumRides = s.NumRides
	resp.Seconds = float64(dif.Seconds())
	resp.Description = "Profile count by (year, passenger_count) (Mark #3) (go)"

	err := json.NewEncoder(w).Encode(resp)
	if err != nil {
		log.Printf("result encoding error: %s\n", err)
	}
}

func (s *Server) pcountTopNPerYear(year int, rows chan predefined3Row, wg *sync.WaitGroup) {
	defer wg.Done()
	q := s.Frames["passenger_count"].BitmapTopN(10, s.Frames["pickup_year"].Bitmap(uint64(year)))
	response, err := s.Client.Query(q, nil)
	if err != nil {
		log.Printf("query %v failed with %v", q, err)
	}
	fmt.Printf("%+v\n", response.Result())
	for _, ci := range response.Results()[0].CountItems {
		rows <- predefined3Row{ci.Count, year, int(ci.ID)}
	}
}

type predefined3Response struct {
	NumRides    uint64           `json:"numProfiles"`
	Description string           `json:"description"`
	Seconds     float64          `json:"seconds"`
	Rows        []predefined3Row `json:"rows"`
}

type predefined3Row struct {
	Count          uint64 `json:"count"`
	Year           int    `json:"year"`
	PassengerCount int    `json:"passenger_count"`
}

func (s *Server) HandlePredefined4(w http.ResponseWriter, r *http.Request) {
	concurrency := 32
	t := time.Now()

	keys := make(chan predefined4Row)
	rows := make(chan predefined4Row)
	go func() {
		for year := 2009; year <= 2016; year++ {
			for pcount := 1; pcount <= 7; pcount++ {
				keys <- predefined4Row{0, 0, pcount, year}
			}
		}
		close(keys)
	}()

	var wg = &sync.WaitGroup{}

	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func() {
			s.distTopNPerYearPcount(keys, rows, wg)
		}()
	}
	go func() {
		wg.Wait()
		close(rows)
	}()

	resp := predefined4Response{}
	resp.Rows = make([]predefined4Row, 0, 2500)

	for row := range rows {
		resp.Rows = append(resp.Rows, row)
	}

	sort.Sort(byYearCount(resp.Rows))
	dif := time.Since(t)

	resp.NumRides = s.NumRides
	resp.Description = "Profile count by (year, passenger_count, trip_distance), ordered by (year, count) (Mark #4) (go)"
	resp.Seconds = float64(dif.Seconds())
	resp.Threshold = percentThreshold

	err := json.NewEncoder(w).Encode(resp)
	if err != nil {
		fmt.Printf("result encoding error: %s\n", err)
	}
}

func (s *Server) distTopNPerYearPcount(keys <-chan predefined4Row, rows chan<- predefined4Row, wg *sync.WaitGroup) {
	defer wg.Done()
	for key := range keys {
		qIntersect := s.Index.Intersect(
			s.Frames["pickup_year"].Bitmap(uint64(key.PickupYear)),
			s.Frames["passenger_count"].Bitmap(uint64(key.PassengerCount)),
		)
		q := s.Frames["dist_miles"].BitmapTopN(10, qIntersect)
		response, err := s.Client.Query(q, nil)
		if err != nil {
			log.Printf("query %v failed with: %v", q, err)
			return
		}
		for _, ci := range response.Results()[0].CountItems {
			rows <- predefined4Row{ci.Count, int(ci.ID), key.PassengerCount, key.PickupYear}
		}
	}
}

type predefined4Response struct {
	NumRides    uint64           `json:"numProfiles"`
	Description string           `json:"description"`
	Seconds     float64          `json:"seconds"`
	Threshold   float64          `json:"percentageThreshold"`
	Rows        []predefined4Row `json:"rows"`
}

type byYearCount []predefined4Row

func (a byYearCount) Len() int      { return len(a) }
func (a byYearCount) Swap(i, j int) { a[i], a[j] = a[j], a[i] }
func (a byYearCount) Less(i, j int) bool {
	if a[i].PickupYear > a[j].PickupYear {
		return true
	}
	if a[i].PickupYear == a[j].PickupYear && a[i].Count > a[j].Count {
		return true
	}
	return false
}

type predefined4Row struct {
	Count          uint64 `json:"count"`
	Distance       int    `json:"distance"`
	PassengerCount int    `json:"passenger_count"`
	PickupYear     int    `json:"pickup_year"`
}

func (s *Server) getRideCount() uint64 {
	var count uint64 = 0
	for n := 0; n < 3; n++ {
		q := s.Index.Count(s.Frames["cab_type"].Bitmap(uint64(n)))
		response, _ := s.Client.Query(q, nil)
		count += response.Result().Count
	}
	return count
}

func (s *Server) HandlePredefined5(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	q := s.Frames["drop_grid_id"].TopN(0)
	response, err := s.Client.Query(q, nil)
	if err != nil {
		log.Printf("query %v failed with: %v", q, err)
	}

	resp := predefined5Response{}
	resp.Seconds = time.Now().Sub(start).Seconds()
	resp.Description = "Count of pickup locations for top dropoff location"
	resp.NumRides = s.NumRides

	resp.Rows = make([]predefined5Row, 0, 5)
	for _, c := range response.Result().CountItems {
		x := c.ID % 100
		y := c.ID / 100
		resp.Rows = append(resp.Rows, predefined5Row{c.ID, c.Count, x, y})
	}
	fmt.Printf("%+v\n", resp)

	enc := json.NewEncoder(w)
	err = enc.Encode(resp)
	if err != nil {
		log.Printf("writing results: %v to responsewriter: %v", resp, err)
	}
}

type predefined5Response struct {
	NumRides    uint64           `json:"numProfiles"`
	Description string           `json:"description"`
	Seconds     float64          `json:"seconds"`
	Rows        []predefined5Row `json:"rows"`
}

type predefined5Row struct {
	PickupGridID uint64 `json:"pickup_grid_id"`
	Count        uint64 `json:"count"`
	X            uint64 `json:"x"`
	Y            uint64 `json:"y"`
}
