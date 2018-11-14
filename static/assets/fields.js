var field_controls = [
    {
        field: "cab_type",
        group: "nyc-opendata",
        name: "Cab type",
        row_map: {
            0: "Green",
            1: "Yellow"
        }
    },
    {
        field: "passenger_count",
        group: "nyc-opendata",
        name: "Passenger count",
        row_seq: {
            min: 0,
            max: 8
        }
    },
    {
        field: "pickup_year",
        group: "nyc-opendata",
        name: "Year",
        row_seq: {
            min: 2009,
            max: 2015
        }
    },
    {
        field: "pickup_month",
        group: "nyc-opendata",
        name: "Month",
        row_map: {
            1: "January",
            2: "February",
            3: "March",
            4: "April",
            5: "May",
            6: "June",
            7: "July",
            8: "August",
            9: "September",
            10: "October",
            11: "November",
            12: "December"
        }
    },
    {
        field: "pickup_day",
        group: "nyc-opendata",
        name: "Day of week",
        row_map: {
            0: "Monday",
            1: "Tuesday",
            2: "Wednesday",
            3: "Thursday",
            4: "Friday",
            5: "Saturday",
            6: "Sunday"
        }
    },
    {
        field: "pickup_time",
        group: "nyc-opendata",
        name: "Time (30-min)",
        row_seq: {
            min: 0,
            max: 47
        }
    },
    {
        field: "dist_miles",
        group: "nyc-opendata",
        name: "Distance (mi)",
        row_seq: {
            min: 0,
            max: 25
        },
        suffix: " mi"
    },
    {
        field: "total_amount_dollars",
        group: "nyc-opendata",
        name: "Total fare ($)",
        row_seq: {
            min: 0,
            max: 100
        },
        prefix: "$"

    },
    {
        logo: "/assets/nyc-opendata-logo.png",
        text: "NYC OpenData"
    },
    {
        field: "duration_minutes",
        group: "pdk-computed",
        name: "Duration (min)",
        row_seq: {
            min: 0,
            max: 60
        },
        suffix: " min"
    },
    {
        field: "speed_mph",
        group: "pdk-computed",
        name: "Speed (mph)",
        row_seq: {
            min: 0,
            max: 60
        },
        suffix: " mph"
    },
    {
        logo: "/assets/PDK-logo.png",
        text: "PDK"
    },
    {
        field: "weather_condition",
        group: "weather",
        name: "Condition",
        row_map: {
            0: "Unknown",
            1: "Clear",
            2: "Rain",
            3: "Light Rain",
            4: "Heavy Rain",
            5: "Thunderstorm",
            6: "Thunderstorms and Rain",
            7: "Light Thunderstorms and Rain",
            8: "Heavy Thunderstorms and Rain",
            9: "Overcast",
            10: "Mostly Cloudy",
            11: "Partly Cloudy",
            12: "Scattered Clouds",
            13: "Fog",
            14: "Mist",
            15: "Haze",
            16: "Light Freezing Rain",
            17: "Snow",
            18: "Light Snow",
            19: "Heavy Snow",
            20: "Squalls"
        }
    },
    {
        field: "temp_f",
        group: "weather",
        name: "Temperature (°F)",
        row_seq: {
            min: 160,
            max: 260,
            step: 2
        },
        val_seq: {
            min: 50,
            max: 100
        },
        suffix: "°F"
    },
    {
        field: "precipitation_inches",
        group: "weather",
        name: "Precip. (in)",
        row_seq: {
            min: 0,
            max: 10
        },
        val_seq: {
            min: 0,
            max: 0.5
        },
        suffix: " inches"
    },
    // precipitation_type: 0,
    {
        field: "pressure_i",
        group: "weather",
        name: "Pressure (inHg)",
        row_seq: {
            min: 180,
            max: 212
        },
        val_seq: {
            min: 29.8,
            max: 30.12
        },
        suffix: " inHg"
    },
    {
        field: "humidity",
        group: "weather",
        name: "Humidity",
        row_seq: {
            min: 50,
            max: 90
        }
    },
    {
        logo: "/assets/wunderground-logo.png",
        text: "Wunderground"
    },
    {
        field: "pickup_elevation",
        group: "google-maps",
        name: "Pickup elevation (ft)",
        row_seq: {
            min: 0,
            max: 42
        },
        val_seq: {
            min: -30,
            max: 180
        }
    },
    {
        field: "drop_elevation",
        group: "google-maps",
        name: "Dropoff elevation (ft)",
        row_seq: {
            min: 0,
            max: 42
        },
        val_seq: {
            min: -30,
            max: 180
        }
    },
    {
        logo: "/assets/google-maps-logo.png",
        text: "Google Maps"
    },
];
