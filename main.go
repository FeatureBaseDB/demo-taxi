package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	pilosa "github.com/pilosa/go-pilosa"
)

const host = ":10101"
const indexName = "taxi"
const percentThreshold = 90

func main() {
	server := NewServer()
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

func NewServer() *Server {
	server := &Server{}

	router := mux.NewRouter()
	//router.HandleFunc("/", server.HandleFrontend).Methods("GET")
	//router.HandleFunc("/assets/{file}", server.HandleFrontend).Methods("GET")
	//router.HandleFunc("/query/intersect", server.HandleIntersect).Methods("GET")
	//router.HandleFunc("/query/topn", server.HandleTopN).Methods("GET")
	//router.HandleFunc("/predefined/1", server.HandlePredefined1).Methods("GET")
	//router.HandleFunc("/predefined/2", server.HandlePredefined2).Methods("GET")
	router.HandleFunc("/predefined/3", server.HandlePredefined3Serial).Methods("GET")
	router.HandleFunc("/predefined/4", server.HandlePredefined4).Methods("GET")
	//router.HandleFunc("/predefined/5", server.HandlePredefined5).Methods("GET")

	client := pilosa.DefaultClient()
	index, _ := pilosa.NewIndex(indexName, nil)
	_ = client.EnsureIndex(index)

	yearFrame, _ := index.Frame("pickup_year", nil)
	_ = client.EnsureFrame(yearFrame)

	pcountFrame, _ := index.Frame("passenger_count", nil)
	_ = client.EnsureFrame(pcountFrame)

	distFrame, _ := index.Frame("dist_miles", nil)
	_ = client.EnsureFrame(distFrame)

	typeFrame, _ := index.Frame("cab_type", nil)
	_ = client.EnsureFrame(typeFrame)

	frames := map[string]*pilosa.Frame{
		"year":    yearFrame,
		"pcount":  pcountFrame,
		"dist":    distFrame,
		"cabtype": typeFrame,
	}

	server.Router = router
	server.Client = client
	server.Index = index
	server.Frames = frames
	return server
}

func (s *Server) testQuery() {
	// Send a Bitmap query. PilosaException is thrown if execution of the query fails.
	response, _ := s.Client.Query(s.Frames["year"].Bitmap(2013), nil)

	// Get the result
	result := response.Result()
	// Act on the result
	if result != nil {
		bits := result.Bitmap.Bits
		fmt.Printf("Got bits: %v\n", bits)
	}
}

func (s *Server) Serve() {
	fmt.Println("listening at :8000")
	log.Fatal(http.ListenAndServe(":8000", s.Router))
}

func (s *Server) HandlePredefined3(w http.ResponseWriter, r *http.Request) {
	// NxM queries, N, M = cardinality of passenger_count (8), year (7) - medium priority
	t := time.Now()
	numRides := s.getRideCount()
	rows := make([]Predefined3Row, 40)
	// queries go here
	dif := time.Since(t)

	err := json.NewEncoder(w).Encode(predefined3Response{
		numRides,
		"Profile count by (year, passenger_count) (Mark #3) (go)",
		float64(dif.Seconds()),
		rows,
	})

	if err != nil {
		fmt.Printf("result encoding error: %s\n", err)
	}

}

func (s *Server) HandlePredefined3Serial(w http.ResponseWriter, r *http.Request) {
	// NxM queries, N, M = cardinality of passenger_count (8), year (7) - medium priority

	t := time.Now()
	numRides := s.getRideCount()
	rows := make([]Predefined3Row, 40)

	for year := 2009; year <= 2016; year++ {
		for pcount := 1; pcount <= 7; pcount++ {
			response, _ := s.Client.Query(s.Index.Intersect(
				s.Frames["year"].Bitmap(uint64(year)),
				s.Frames["pcount"].Bitmap(uint64(pcount)),
			), nil)
			rows = append(rows, Predefined3Row{
				response.Result().Count,
				year,
				pcount,
			})
		}
	}
	dif := time.Since(t)

	err := json.NewEncoder(w).Encode(predefined3Response{
		numRides,
		"Profile count by (year, passenger_count) (Mark #3) (go)",
		float64(dif.Seconds()),
		rows,
	})

	if err != nil {
		fmt.Printf("result encoding error: %s\n", err)
	}

}

type predefined3Response struct {
	NumRides    uint64           `json:"numProfiles"`
	Description string           `json:"description"`
	Seconds     float64          `json:"seconds"`
	Rows        []Predefined3Row `json:"rows"`
}

type Predefined3Row struct {
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
		q := s.Index.Count(s.Frames["cabtype"].Bitmap(uint64(n)))
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

func HandlePredefined2(w http.ResponseWriter, r *http.Request) {
	// N queries, N = cardinality of passenger_count (8) - low priority
}

func HandlePredefined5(w http.ResponseWriter, r *http.Request) {
	// 2 queries - lowest priority
}
