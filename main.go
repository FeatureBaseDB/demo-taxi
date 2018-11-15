//go:generate statik -src=./static

package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
	_ "github.com/pilosa/demo-taxi/statik"
	pilosa "github.com/pilosa/go-pilosa"
	"github.com/pkg/errors"
	"github.com/rakyll/statik/fs"
	"github.com/spf13/pflag"
)

const defaultHost = "http://localhost:10101"
const indexName = "taxi"

var Version = "v0.4.0" // demo version

func main() {
	pilosaAddr := pflag.String("pilosa", defaultHost, "host:port for pilosa")
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
	Address    string
	Router     *mux.Router
	Client     *pilosa.Client
	Index      *pilosa.Index
	UsersIndex *pilosa.Index
	Fields     map[string]*pilosa.Field
	NumRides   uint64
}

func NewServer(pilosaAddr string) (*Server, error) {
	server := &Server{
		Address: pilosaAddr,
		Fields:  make(map[string]*pilosa.Field),
	}

	router := mux.NewRouter()
	router.HandleFunc("/", server.HandleStatic).Methods("GET")
	router.HandleFunc("/assets/{file}", server.HandleStatic).Methods("GET")
	router.HandleFunc("/version", server.HandleVersion).Methods("GET")
	router.HandleFunc("/query/topn", server.HandleTopN).Methods("GET")
	router.HandleFunc("/query/join", server.HandleJoin).Methods("POST")
	router.HandleFunc("/predefined/1", server.HandlePredefined1).Methods("GET")
	router.HandleFunc("/predefined/2", server.HandlePredefined2).Methods("GET")
	router.HandleFunc("/predefinedalt/2", server.HandlePredefinedAlt2).Methods("GET")
	router.HandleFunc("/predefined/3", server.HandlePredefined3).Methods("GET")
	router.HandleFunc("/predefined/4", server.HandlePredefined4).Methods("GET")
	router.HandleFunc("/predefined/5", server.HandlePredefined5).Methods("GET")
	router.HandleFunc("/query", server.HandleQuery).Methods("GET")

	pilosaURI, err := pilosa.NewURIFromAddress(pilosaAddr)
	if err != nil {
		return nil, err
	}
	client, err := pilosa.NewClient(pilosaURI)
	if err != nil {
		return nil, errors.Wrap(err, "getting client")
	}
	index := pilosa.NewIndex(indexName)
	err = client.EnsureIndex(index)
	if err != nil {
		return nil, fmt.Errorf("client.EnsureIndex: %v", err)
	}

	// TODO should be automatic from /schema
	fields := []string{
		"cab_type",
		"passenger_count",
		"total_amount_dollars",
		"pickup_time",
		"pickup_day",
		"pickup_mday",
		"pickup_month",
		"pickup_year",
		"drop_time",
		"drop_day",
		"drop_mday",
		"drop_month",
		"drop_year",
		"dist_miles",
		"duration_minutes",
		"speed_mph",
		"pickup_grid_id",
		"drop_grid_id",
		"weather_condition",
		// "precipitation_type",
		"precipitation_inches",
		"temp_f",
		"pressure_i",
		"humidity",
		"pickup_elevation",
		"drop_elevation",
	}

	for _, fieldName := range fields {
		field := index.Field(fieldName, nil)
		if err != nil {
			return nil, fmt.Errorf("index.Field %v: %v", fieldName, err)
		}
		err = client.EnsureField(field)
		if err != nil {
			return nil, fmt.Errorf("client.EnsureField %v: %v", fieldName, err)
		}

		server.Fields[fieldName] = field
	}

	usersIndex := pilosa.NewIndex("users")

	server.Router = router
	server.Client = client
	server.Index = index
	server.UsersIndex = usersIndex
	server.NumRides = server.getRideCount()
	return server, nil
}

func (s *Server) HandleVersion(w http.ResponseWriter, r *http.Request) {
	if err := json.NewEncoder(w).Encode(struct {
		DemoVersion   string `json:"demoversion"`
		PilosaVersion string `json:"pilosaversion"`
	}{
		DemoVersion:   Version,
		PilosaVersion: s.getPilosaVersion(),
	}); err != nil {
		log.Printf("write version response error: %s", err)
	}
}

type versionResponse struct {
	Version string `json:"version"`
}

func (s *Server) getPilosaVersion() string {
	resp, err := http.Get(s.Address + "/version")
	if err != nil {
		log.Printf("problem getting version: %v\n", err)
		return ""
	}
	defer resp.Body.Close()
	body, _ := ioutil.ReadAll(resp.Body)
	version := new(versionResponse)
	json.Unmarshal(body, &version)
	return version.Version
}

func (s *Server) testQuery() error {
	// Send a Row query. PilosaException is returned if execution of the query fails.
	response, err := s.Client.Query(s.Fields["pickup_year"].Row(2013), nil)
	if err != nil {
		return fmt.Errorf("s.Client.Query: %v", err)
	}

	// Get the result
	result := response.Result()
	// Act on the result
	if result != nil {
		bits := result.Row().Columns
		fmt.Printf("Got bits: %v\n", bits)
	}
	return nil
}

func (s *Server) Serve() {
	fmt.Println("running at http://0.0.0.0:8000")
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

type intersectResponse struct {
	Rows     []intersectRow `json:"rows"`
	Seconds  float64        `json:"seconds"`
	NumRides uint64         `json:"numRides"`
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

	field := r.URL.Query()["field"][0]
	q := s.Fields[field].TopN(0)

	response, err := s.Client.Query(q, nil)

	dif := time.Since(start)

	if field == "pickup_grid_id" {
		resp := topNGridResponse{}
		resp.NumRides = s.getRideCount()
		resp.Description = "Pickup Locations"
		for _, c := range response.Result().CountItems() {
			x := c.ID % 100
			y := c.ID / 100
			resp.Rows = append(resp.Rows, topNGridRow{c.ID, c.Count, x, y})
		}
		resp.Seconds = float64(dif.Seconds())
		enc := json.NewEncoder(w)
		err = enc.Encode(resp)
		if err != nil {
			log.Printf("writing results: %v to responsewriter: %v", resp, err)
		}
	} else {
		resp := topnResponse{}
		resp.Rows = make([]topnRow, 0, 50)
		resp.NumRides = s.getRideCount()
		resp.Query = fmt.Sprintf("TopN(field=%s)", field)

		maxID := maxIDMap[field]
		if maxID == 0 {
			maxID = 1000000
		}
		for _, ci := range response.Result().CountItems() {
			if ci.ID > maxID {
				continue
			}
			resp.Rows = append(resp.Rows, topnRow{ci.ID, ci.Count})
		}
		resp.Seconds = float64(dif.Seconds())
		enc := json.NewEncoder(w)
		err = enc.Encode(resp)
		if err != nil {
			log.Printf("writing results: %v to responsewriter: %v", resp, err)
		}
	}

}

type topNGridResponse struct {
	NumRides    uint64        `json:"numRides"`
	Description string        `json:"description"`
	Seconds     float64       `json:"seconds"`
	Rows        []topNGridRow `json:"rows"`
}

type topNGridRow struct {
	PickupGridID uint64 `json:"rowID"`
	Count        uint64 `json:"count"`
	X            uint64 `json:"x"`
	Y            uint64 `json:"y"`
}

type topnResponse struct {
	Rows     []topnRow `json:"rows"`
	Query    string    `json:"query"`
	Seconds  float64   `json:"seconds"`
	NumRides uint64    `json:"numRides"`
}

type topnRow struct {
	RowId uint64 `json:"rowID"`
	Count uint64 `json:"count"`
}

func (s *Server) HandlePredefined1(w http.ResponseWriter, r *http.Request) {
	// N queries, N = cardinality of cab_type (3) - lowest priority
	start := time.Now()

	q := s.Fields["cab_type"].TopN(2)
	response, err := s.Client.Query(q, nil)
	if err != nil {
		log.Printf("query %v failed with: %v", q, err)
	}

	resp := predefined1Response{}
	resp.Description = "Ride count by cab type (Mark #1)"
	resp.NumRides = s.getRideCount()

	resp.Rows = make([]predefined1Row, 0, 5)
	for _, c := range response.Result().CountItems() {
		resp.Rows = append(resp.Rows, predefined1Row{c.ID, c.Count})
	}

	resp.Seconds = time.Since(start).Seconds()

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
	NumRides    uint64           `json:"numRides"`
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
	resp.NumRides = s.getRideCount()
	resp.Description = "average(total_amount) by passenger_count (Mark #2)"
	resp.Rows = make([]predefined2Row, 0, maxpcount)
	for id, amt := range arr {
		resp.Rows = append(resp.Rows, predefined2Row{uint64(id), amt})
	}
	resp.Seconds = time.Since(start).Seconds()

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
	NumRides    uint64           `json:"numRides"`
}

type predefined2Row struct {
	PassengerCount uint64  `json:"passengerCount"`
	AverageAmount  float64 `json:"average(totalAmount)"`
}

func (s *Server) avgCostForPassengerCount(pcount int, values []float64, wg *sync.WaitGroup) {
	defer wg.Done()
	// TopN(field=total_amount_dollars, Row(passenger_count=pcount))
	// for each $ amount, add amnt*num_rides to total amount and add num_rides to total rides.
	// now just calc avg
	tadField, ok := s.Fields["total_amount_dollars"]
	if !ok {
		log.Println("total_amount_dollars field doesn't exist")
	}
	pcField, ok := s.Fields["passenger_count"]
	if !ok {
		log.Println("passenger_count field doesn't exist")
	}
	pcRow := pcField.Row(uint64(pcount))
	query := tadField.RowTopN(1000, pcRow)
	qtime := time.Now()
	results, err := s.Client.Query(query, nil)
	log.Printf("query time for passenger count: %v is %v", pcount, time.Since(qtime).Seconds())
	if err != nil {
		log.Printf("query %v failed with: %v", query, err)
		return
	}
	var num_rides uint64 = 0
	var total_amount uint64 = 0
	if len(results.Results()[0].CountItems()) == 0 {
		// prevent NaN
		values[pcount] = 0
		return
	}
	for _, cri := range results.Results()[0].CountItems() {
		num_rides += cri.Count
		total_amount += cri.ID * cri.Count
	}
	values[pcount] = float64(total_amount) / float64(num_rides)
}

func (s *Server) HandlePredefinedAlt2(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	var wg = &sync.WaitGroup{}
	maxpcount := 8
	resp := predefined2Response{}
	arr := make([]float64, maxpcount+1)
	for pcount := 1; pcount <= maxpcount; pcount++ {
		wg.Add(1)
		go s.avgCostForPassengerCountAlt(pcount, arr, wg)
	}
	wg.Wait()
	resp.NumRides = s.getRideCount()
	resp.Description = "average(total_amount) by passenger_count (Mark #2) alt impl."
	resp.Rows = make([]predefined2Row, 0, maxpcount)
	for id, amt := range arr {
		resp.Rows = append(resp.Rows, predefined2Row{uint64(id), amt})
	}
	resp.Seconds = time.Since(start).Seconds()

	enc := json.NewEncoder(w)
	err := enc.Encode(resp)
	if err != nil {
		log.Printf("writing results: %v to responsewriter: %v", resp, err)
	}
}

func (s *Server) avgCostForPassengerCountAlt(pcount int, values []float64, wg *sync.WaitGroup) {
	defer wg.Done()
	resp, err := s.Client.Query(s.Index.RawQuery(fmt.Sprintf("Sum(Row(passenger_count=%d), frame=cost_cents, field=cost_cents)", pcount)))
	if err != nil {
		log.Println(errors.Wrap(err, "sum query for passenger"))
	}
	res := resp.ResultList[0]

	values[pcount] = float64(res.Value()) / float64(res.Count())
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
		resp.Rows = append(resp.Rows, row)
	}
	dif := time.Since(t)

	resp.NumRides = s.getRideCount()
	resp.Seconds = float64(dif.Seconds())
	resp.Description = "Ride count by (year, passenger_count) (Mark #3)"

	err := json.NewEncoder(w).Encode(resp)
	if err != nil {
		log.Printf("result encoding error: %s\n", err)
	}
}

func (s *Server) pcountTopNPerYear(year int, rows chan predefined3Row, wg *sync.WaitGroup) {
	defer wg.Done()
	q := s.Fields["passenger_count"].RowTopN(10, s.Fields["pickup_year"].Row(uint64(year)))
	response, err := s.Client.Query(q, nil)
	if err != nil {
		log.Printf("query %v failed with %v", q, err)
	}

	for _, ci := range response.Results()[0].CountItems() {
		rows <- predefined3Row{ci.Count, year, int(ci.ID)}
	}
}

type predefined3Response struct {
	NumRides    uint64           `json:"numRides"`
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

	resp.NumRides = s.getRideCount()
	resp.Description = "Ride count by (year, passenger_count, trip_distance), ordered by (year, count) (Mark #4)"
	resp.Seconds = float64(dif.Seconds())

	err := json.NewEncoder(w).Encode(resp)
	if err != nil {
		fmt.Printf("result encoding error: %s\n", err)
	}
}

func (s *Server) distTopNPerYearPcount(keys <-chan predefined4Row, rows chan<- predefined4Row, wg *sync.WaitGroup) {
	defer wg.Done()
	for key := range keys {
		qIntersect := s.Index.Intersect(
			s.Fields["pickup_year"].Row(uint64(key.PickupYear)),
			s.Fields["passenger_count"].Row(uint64(key.PassengerCount)),
		)
		q := s.Fields["dist_miles"].RowTopN(10, qIntersect)
		response, err := s.Client.Query(q, nil)
		if err != nil {
			log.Printf("query %v failed with: %v", q, err)
			return
		}
		for _, ci := range response.Results()[0].CountItems() {
			rows <- predefined4Row{ci.Count, int(ci.ID), key.PassengerCount, key.PickupYear}
		}
	}
}

type predefined4Response struct {
	NumRides    uint64           `json:"numRides"`
	Description string           `json:"description"`
	Seconds     float64          `json:"seconds"`
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
		q := s.Index.Count(s.Fields["cab_type"].Row(uint64(n)))
		response, _ := s.Client.Query(q, nil)
		count += uint64(response.Result().Count())
	}
	return count
}

func (s *Server) HandlePredefined5(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	dropField := s.Fields["drop_grid_id"]
	q := dropField.TopN(1)
	response, err := s.Client.Query(q, nil)
	if err != nil {
		log.Printf("query %v failed with: %v", q, err)
	}
	topDropoffID := response.Result().CountItems()[0].ID

	q = s.Fields["pickup_grid_id"].RowTopN(0, dropField.Row(topDropoffID))
	response, err = s.Client.Query(q, nil)
	if err != nil {
		log.Printf("query %v failed with: %v", q, err)
	}

	resp := predefined5Response{}
	resp.Description = "Count of pickup locations for top dropoff location"
	resp.NumRides = s.getRideCount()

	resp.Rows = make([]predefined5Row, 0, 5)
	for _, c := range response.Result().CountItems() {
		x := c.ID % 100
		y := c.ID / 100
		resp.Rows = append(resp.Rows, predefined5Row{c.ID, c.Count, x, y})
	}

	resp.Seconds = time.Now().Sub(start).Seconds()

	enc := json.NewEncoder(w)
	err = enc.Encode(resp)
	if err != nil {
		log.Printf("writing results: %v to responsewriter: %v", resp, err)
	}
}

type predefined5Response struct {
	NumRides    uint64           `json:"numRides"`
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

func (s *Server) HandleQuery(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	q, err := url.QueryUnescape(r.URL.RawQuery)
	if err != nil {
		fmt.Fprintf(w, fmt.Sprintf(`{"error": "%s"}`, err))
		return
	}

	response, err := s.Client.Query(s.Index.RawQuery(q), nil)
	if err != nil {
		fmt.Fprintf(w, fmt.Sprintf(`{"error": "%s"}`, err))
		return
	}
	dif := time.Since(start)

	resp := intersectResponse{}
	resp.NumRides = s.getRideCount()
	resp.Seconds = float64(dif.Seconds())
	resp.Rows = []intersectRow{intersectRow{uint64(response.Result().Count())}}

	enc := json.NewEncoder(w)
	err = enc.Encode(resp)
	if err != nil {
		log.Printf("writing results: %v to responsewriter: %v", resp, err)
	}
}

func (s *Server) HandleJoin(w http.ResponseWriter, r *http.Request) {
	jr := &joinRequest{}
	jr.UserQuery = r.FormValue("user_query")
	jr.RideQuery = r.FormValue("ride_query")

	fmt.Printf("userQ: '%s'\nrideQ: '%s'\n", jr.UserQuery, jr.RideQuery)

	start := time.Now()
	resp, err := s.Client.Query(s.UsersIndex.RawQuery(jr.UserQuery))
	if err != nil {
		log.Printf("ERROR QUERYING USERS: %v", err.Error())
		http.Error(w, "querying pilosa users: "+err.Error(), 500)
		return
	}
	userIDs := resp.Result().Row().Columns
	fmt.Println("Count userIDs ", len(userIDs))
	userEventQuery := s.genJoin(userIDs)
	log.Printf("user event query len: %d, first: %s\n\n", len(userEventQuery), userEventQuery[:300])
	fullQuery := "Count(Intersect(" + userEventQuery + ", " + jr.RideQuery + "))"
	log.Printf("full query len: %d, first: %s\nlast: %s", len(fullQuery), fullQuery[:300], fullQuery[len(fullQuery)-300:])
	resp, err = s.Client.Query(s.Index.RawQuery(fullQuery))
	if err != nil {
		log.Printf("ERROR QUERYING rides: %v", err.Error())
		http.Error(w, "querying pilosa - fullquery: "+err.Error(), 500)
		return
	}
	dif := time.Since(start)
	fmt.Println("RESP: ", resp)

	mresp := intersectResponse{
		Rows:     []intersectRow{{Count: uint64(resp.Result().Count())}},
		Seconds:  dif.Seconds(),
		NumRides: s.getRideCount(),
	}
	if len(userIDs) == 0 {
		mresp.Rows[0].Count = 0
	}

	enc := json.NewEncoder(w)
	err = enc.Encode(&mresp)
	if err != nil {
		http.Error(w, "encoding response: "+err.Error(), 500)
	}
}

func (s *Server) genJoin(userIDs []uint64) string {
	b := strings.Builder{}
	b.WriteString("Union(")
	if len(userIDs) == 0 {
		return ""
	}
	for _, uid := range userIDs[:len(userIDs)-1] {
		b.WriteString(fmt.Sprintf("Row(user_id=%d),", uid))
	}
	b.WriteString(fmt.Sprintf("Row(user_id=%d))", userIDs[len(userIDs)-1]))
	return b.String()
}

type joinRequest struct {
	UserQuery string `json:"user_query"`
	RideQuery string `json:"ride_query"`
}
