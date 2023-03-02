package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"index/suffixarray"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
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

type Query struct {
	searchTerm string
	limit      int32
	offset     int32
	orderby    string
	sortby     string
}

type Searcher struct {
	data    string
	indexes *suffixarray.Index
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

	offset := 1
	offsetQry := params["offset"]
	if len(offsetQry) >= 1 {
		offst, ok := strconv.Atoi(strings.Trim(offsetQry[0], " "))
		if ok != nil || offst < 1 || offst > 100 {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte("Invalid request. The offset param needs to be an int >= 1 and <= 100"))
		}
		offset = offst
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
		offset:     int32(offset),
	}

	return qParams
}

func handleSearch(searcher Searcher) func(w http.ResponseWriter, r *http.Request) {
	regx := regexp.MustCompile(`^[a-zA-Z]{3}[ a-zA-Z]*$`)
	return func(w http.ResponseWriter, r *http.Request) {
		enableCors(&w)

		query := parseRequest(w, r, regx)
		results := searcher.Search(query.searchTerm)

		buf := &bytes.Buffer{}
		enc := json.NewEncoder(buf)
		err := enc.Encode(results)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte("Response encoding failure"))
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write(buf.Bytes())
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

func (s *Searcher) Search(query string) []string {
	results := []string{}

	// TODO investigate https://www.nightfall.ai/blog/best-go-regex-library
	reg := regexp.MustCompile(fmt.Sprintf(`(?i)%v`, query))
	matches := reg.FindAllStringIndex(s.data, -1)
	fmt.Println(len(matches))
	if matches != nil {
		for _, pos := range matches {
			results = append(results, s.data[pos[0]-50:pos[1]+50])
		}
	}

	return results
}
