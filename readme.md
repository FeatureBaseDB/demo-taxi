<a href="https://github.com/pilosa"><img src="https://img.shields.io/badge/pilosa-v0.3.1-blue.svg"></a>

# import data
Use the Pilosa Dev Kit to import the taxi data: https://github.com/pilosa/pdk


# run demo app
`git clone https://github.com/pilosa/demo-taxi.git`

`cd demo-taxi`

`go get -u github.com/rakyll/statik`

`glide install && go install github.com/rakyll/statik`

`go generate && go build . && ./demo-taxi`

Then open http://127.0.0.1:8000 and try out some queries!
