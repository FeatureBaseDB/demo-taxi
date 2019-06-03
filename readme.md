<a href="https://github.com/pilosa"><img src="https://img.shields.io/badge/pilosa-v0.3.1-blue.svg"></a>

# import data
Be sure you have pilosa running in a terminal and the Pilosa Dev Kit installed.
The Pilosa Dev Kit can be installed at: https://github.com/pilosa/pdk.

To import the data needed to run the demo, be sure you are in the pdk directory and then run the following commands
`pdk taxi`

`pdk fakeusers --num=10000`

For more information on `pdk taxi`, visit: https://github.com/pilosa/pdk.
The above commands create the taxi and users indexes that will be referenced in the demo.

In addition, the open file limit may need to expanded in some cases. If you are using a Mac OSX please refer to ____ for assistance.


# run demo app
'cd $GOPATH`

`git clone https://github.com/pilosa/demo-taxi.git`

`cd demo-taxi`

`go get -u github.com/rakyll/statik`

`go install github.com/rakyll/statik`

`go generate && go build . && ./demo-taxi`

Then open http://127.0.0.1:8000 and try out some queries!

