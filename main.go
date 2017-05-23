package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/mux"
	pilosa "github.com/pilosa/go-pilosa"
	"github.com/spf13/pflag"
)

const host = ":10101"
const indexName = "taxi"
const percentThreshold = 90

func main() {
	pilosaAddr := pflag.String("pilosa", "localhost:10101", "host:port for pilosa")
	pflag.Parse()

	server, err := NewServer(*pilosaAddr)
	if err != nil {
		log.Fatalf("getting new server: %v", err)
	}
	//server.testQuery()
	fmt.Printf("ride count: %d\n", server.getRideCount())
	server.Serve()
}

type Server struct {
	Router *mux.Router
	Client *pilosa.Client
	Index  *pilosa.Index
	Frames map[string]*pilosa.Frame
}

func NewServer(pilosaAddr string) (*Server, error) {
	server := &Server{
		Frames: make(map[string]*pilosa.Frame),
	}

	router := mux.NewRouter()
	//router.HandleFunc("/", server.HandleFrontend).Methods("GET")
	//router.HandleFunc("/assets/{file}", server.HandleFrontend).Methods("GET")
	//router.HandleFunc("/query/intersect", server.HandleIntersect).Methods("GET")
	//router.HandleFunc("/query/topn", server.HandleTopN).Methods("GET")
	//router.HandleFunc("/predefined/1", server.HandlePredefined1).Methods("GET")
	router.HandleFunc("/predefined/2", server.HandlePredefined2).Methods("GET")
	router.HandleFunc("/predefined/3", server.HandlePredefined3).Methods("GET")
	router.HandleFunc("/predefined/4", server.HandlePredefined4).Methods("GET")
	//router.HandleFunc("/predefined/5", server.HandlePredefined5).Methods("GET")

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
	fmt.Println("listening at :8000")
	log.Fatal(http.ListenAndServe(":8000", s.Router))
}

func (s *Server) HandlePredefined2(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	var wg = &sync.WaitGroup{}
	maxpcount := 8
	resp := predefined2Response{}
	resp.AvgPerPassengerAmount = make([]float64, maxpcount+1)
	for pcount := 1; pcount <= maxpcount; pcount++ {
		wg.Add(1)
		go s.avgCostForPassengerCount(pcount, resp.AvgPerPassengerAmount, wg)
	}
	wg.Wait()
	resp.Seconds = time.Now().Sub(start).Seconds()

	enc := json.NewEncoder(w)
	err := enc.Encode(resp)
	if err != nil {
		log.Printf("writing results: %v to responsewriter: %v", resp, err)
	}
}

type predefined2Response struct {
	AvgPerPassengerAmount []float64 `json:"avgCostPerPassengerCount"`
	Description           string    `json:"description"`
	Seconds               float64   `json:"seconds"`
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
	results, err := s.Client.Query(query, nil)
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

	for year := 2009; year <= 2016; year++ {
		for pcount := 1; pcount <= 7; pcount++ {
			go s.countPerYearPcount(year, pcount, rowChan)
		}
	}
	for i := 0; i < 56; i++ {
		resp.Rows = append(resp.Rows, <-rowChan)
	}
	dif := time.Since(t)

	resp.NumRides = s.getRideCount()
	resp.Seconds = float64(dif.Seconds())
	resp.Description = "Profile count by (year, passenger_count) (Mark #3) (go)"

	err := json.NewEncoder(w).Encode(resp)
	if err != nil {
		log.Printf("result encoding error: %s\n", err)
	}
}

func (s *Server) countPerYearPcount(year, pcount int, rows chan predefined3Row) {
	q := s.Index.Count(s.Index.Intersect(
		s.Frames["pickup_year"].Bitmap(uint64(year)),
		s.Frames["passenger_count"].Bitmap(uint64(pcount)),
	))
	response, err := s.Client.Query(q, nil)
	if err != nil {
		log.Printf("query %v failed with: %v", q, err)
	}
	rows <- predefined3Row{response.Result().Count,	year, pcount}
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
	// NxMxP queries, N, M, P = cardinality of passenger_count (8), year (7), dist_miles (high) - high priority
	t := time.Now()
	numRides := s.getRideCount()
	rows := make([]Predefined4Row, 100)

	// queries go here

	dif := time.Since(t)

	err := json.NewEncoder(w).Encode(predefined4Response{
		numRides,
		"Profile count by (year, passenger_count, trip_distsance), ordered by (year, count) (Mark #4) (go)",
		float64(dif.Seconds()),
		percentThreshold,
		rows,
	})

	if err != nil {
		fmt.Printf("result encoding error: %s\n", err)
	}

}

type predefined4Response struct {
	NumRides    uint64           `json:"numProfiles"`
	Description string           `json:"description"`
	Seconds     float64          `json:"seconds"`
	Threshold   float64          `json:"percentageThreshold"`
	Rows        []Predefined4Row `json:"rows"`
}

type Predefined4Row struct {
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

func HandleFrontend(w http.ResponseWriter, r *http.Request) {
	// static - fine in python
}

func HandleIntersect(w http.ResponseWriter, r *http.Request) {
	// only runs one query - fine in python
}

func HandleTopN(w http.ResponseWriter, r *http.Request) {
	// only runs one query - fine in python
}

func HandlePredefined1(w http.ResponseWriter, r *http.Request) {
	// N queries, N = cardinality of cab_type (3) - lowest priority
}

func HandlePredefined5(w http.ResponseWriter, r *http.Request) {
	// 2 queries - lowest priority
}
