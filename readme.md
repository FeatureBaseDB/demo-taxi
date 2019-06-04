<a href="https://github.com/pilosa"><img src="https://img.shields.io/badge/pilosa-v0.3.1-blue.svg"></a>

# import data
Be sure you have pilosa running in a terminal and the Pilosa Dev Kit installed.
The Pilosa Dev Kit can be installed at: https://github.com/pilosa/pdk.

To import the data needed to run the demo, be sure you are in the pdk directory and then run the following commands
`pdk taxi`

`pdk fakeusers --num=10000`

`pdk weather`

The above commands create the taxi and users indexes that will be referenced in the demo. The `pdk weather` command imports weather data to the taxi index.
Be aware that `pdk fakeusers --num=10000` will ouput the following error:
`2019/06/03 08:49:11 starting field import for firstname: translating records row keys: Key 'V7CIKML6' does not exist in the rowKey to ID map`

`2019/06/03 08:49:11 starting field import for lastname: translating records row keys: Key 'IRPBI3PTLH' does not exist in the rowKey to ID map`

Also be aware that `pdk weather` will take approximately 5 minutes and will output the following errors:
`couldn't get weather data for 2009-02-01 23:00:00 +0000 UTC: hour not found`
`couldn't get weather data for 2009-02-02 00:00:00 +0000 UTC: hour not found`
`couldn't get weather data for 2009-02-03 03:00:00 +0000 UTC: hour not found`
`couldn't get weather data for 2009-02-12 05:00:00 +0000 UTC: hour not found`
`couldn't get weather data for 2013-08-15 19:00:00 +0000 UTC: hour not found`
`couldn't get weather data for 2013-08-24 05:00:00 +0000 UTC: hour not found`
`couldn't get weather data for 2013-08-25 04:00:00 +0000 UTC: hour not found`
`couldn't get weather data for 2013-08-26 02:00:00 +0000 UTC: hour not found`
`couldn't get weather data for 2013-08-27 02:00:00 +0000 UTC: hour not found`
`couldn't get weather data for 2013-08-27 18:00:00 +0000 UTC: hour not found`
`couldn't get weather data for 2013-08-29 11:00:00 +0000 UTC: hour not found`

These errors will not affect the overall performance of the demo.

For more information on `pdk taxi`, visit: https://github.com/pilosa/pdk.

In addition, the open file limit may need to expanded in some cases. If you are using a Mac OSX please refer to ____ for assistance.


# run demo app
`cd $GOPATH`

`git clone https://github.com/pilosa/demo-taxi.git`

`cd demo-taxi`

`go get -u github.com/rakyll/statik`

`go install github.com/rakyll/statik`

`go generate && go build . && ./demo-taxi`

Then open http://127.0.0.1:8000 and try out some queries!

