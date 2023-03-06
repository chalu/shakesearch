/*
Package main implements the search functionality as well as
receiving and responding to HTTP requests. It tries to adhere to the
contract in the /api/api-spec.yml OpenAPI spec
....
*/
package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"
)

func main() {
	searcher := Searcher{}
	err := searcher.Load("completeworks.txt")
	if err != nil {
		log.Fatal(err)
	}

	fs := http.FileServer(http.Dir("./static"))
	http.Handle("/", fs)

	http.HandleFunc("/search", handleSearch(searcher))

	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

	fmt.Printf("Listening on port %s...\n", port)
	err = http.ListenAndServe(fmt.Sprintf(":%s", port), nil)
	if err != nil {
		log.Fatal(err)
	}
}

/* A Query encapsulates all the valid parameters in the HTTP request */
type Query struct {
	searchTerm string
	limit      int32
	page       int32
	orderby    string
	sortby     string
}

/* A Match represents an entry for every match for the search term */
type Match struct {
	Phrase string `json:"phrase"`
}

/* A Result encapsulates the HTTP response payload */
type Result struct {
	Total    int32   `json:"total"`
	Page     int32   `json:"page"`
	Data     []Match `json:"data"`
	Duration int64   `json:"duration"`
}

/* A data structure for the data to be searched */
type Searcher struct {
	data string
}

func enableCors(w *http.ResponseWriter) {
	(*w).Header().Set("Access-Control-Allow-Origin", "*")
}

func parseRequest(w http.ResponseWriter, r *http.Request, regx *regexp.Regexp) Query {
	params := r.URL.Query()

	searchQry, ok := params["q"]
	if !ok || len(searchQry) < 1 {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte("Invalid request. Missing search query in URL params"))
	}

	// TODO match regex pattern
	term := strings.Trim(searchQry[0], " ")
	if !regx.MatchString(term) {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte("Invalid request. Please enter a valid search query"))
	}

	limit := 25
	limitQry := params["limit"]
	if len(limitQry) >= 1 {
		lmt, ok := strconv.Atoi(strings.Trim(limitQry[0], " "))
		if ok != nil || lmt < 1 || lmt > 500 {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte("Invalid request. The limit param needs to be an int >= 1 and <= 500"))
		}
		limit = lmt
	}

	page := 1
	pageQry := params["page"]
	if len(pageQry) >= 1 {
		pg, ok := strconv.Atoi(strings.Trim(pageQry[0], " "))
		if ok != nil || pg < 1 || pg > 100 {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte("Invalid request. The page param needs to be an int >= 1 and <= 100"))
		}
		page = pg
	}

	orderBy := "occurence"
	orderByQry := params["orderby"]
	if len(orderByQry) >= 1 {
		odr := strings.ToLower(strings.Trim(orderByQry[0], " "))
		if odr != "occurence" && odr != "frequency" {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte("Invalid request. You can only order matches by frequency or occurence"))
		}
		orderBy = odr
	}

	sortBy := "DESC"
	sortByQry := params["sortby"]
	if len(sortByQry) >= 1 {
		srt := strings.ToUpper(strings.Trim(sortByQry[0], " "))
		if srt != "ASC" && srt != "DESC" {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte("Invalid request. You can only sort matches in ascending(ASC) or descending(DESC) order"))
		}
		sortBy = srt
	}

	qParams := Query{
		sortby:     sortBy,
		orderby:    orderBy,
		searchTerm: term,
		limit:      int32(limit),
		page:       int32(page),
	}

	return qParams
}

func handleSearch(searcher Searcher) func(w http.ResponseWriter, r *http.Request) {
	regx := regexp.MustCompile(`^[a-zA-Z]{3}[ a-zA-Z]*$`)
	return func(w http.ResponseWriter, r *http.Request) {
		enableCors(&w)

		query := parseRequest(w, r, regx)
		result := searcher.Search(query)

		jsonResp, err := json.Marshal(result)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte("Error encoding response ..."))
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write(jsonResp)
	}
}

func (s *Searcher) Load(filename string) error {
	data, err := ioutil.ReadFile(filename)
	if err != nil {
		return fmt.Errorf("Load: %w", err)
	}

	s.data = string(data)
	return nil
}

func (s *Searcher) Search(query Query) Result {
	starTime := time.Now()

	data := []Match{}
	term := query.searchTerm
	limit := query.limit
	offset := query.page

	start, end := (offset*limit)-limit, (offset * limit)

	// TODO investigate https://www.nightfall.ai/blog/best-go-regex-library
	reg := regexp.MustCompile(fmt.Sprintf(`(?i)%v`, term))
	matches := reg.FindAllStringIndex(s.data, -1)
	count := 0
	if matches != nil {
		count = len(matches)
		for _, pos := range matches {
			data = append(data, Match{
				Phrase: s.data[pos[0]-100 : pos[1]+100],
			})
		}
		data = data[start:end]
	}

	elapsed := time.Since(starTime)
	result := Result{
		Total:    int32(count),
		Page:     offset,
		Data:     data,
		Duration: int64(elapsed.Milliseconds()),
	}

	return result
}
