var user_field_controls = [
    {
        field: "age",
        group: "users",
        name: "Age",
        row_seq: {
            min: 0,
            max: 110
        }
    },
    {
        field: "title",
        group: "users",
        name: "Title",
        row_map: {
            0: "Specialist",
            1: "Director",
            2: "Designer",
            3: "Analyst",
            4: "Consultant",
            5: "Manager",
            6: "Assistant",
            7: "Copywriter",
            8: "Strategist",
            9: "VP",
            10: "Executive",
            11: "QC",
            12: "CEO",
            13: "HR",
            14: "Receptionist",
            15: "Secretary",
            16: "Clerk",
            17: "Auditor",
            18: "Bookkeeper",
            19: "Data Entry",
            20: "Computer Scientist",
            21: "IT Professional",
            22: "UX Designer",
            23: "SQL Developer",
            24: "Web Developer",
            25: "Software Engineer",
            26: "DevOps Engineer",
            27: "Computer Programmer",
            28: "Network Administrator",
            29: "Information Security Analyst",
            30: "Artificial Intelligence Engineer",
            31: "Cloud Architect",
            32: "IT Manager",
            33: "Technical Specialist",
            34: "Application Developer",
            35: "CTO",
            36: "CIO"
        }
    },
    {
        field: "allergies",
        group: "users",
        name: "Allergies",
        row_map: {
            0: "Balsam of Peru",
            1: "Egg",
            2: "Fish",
            3: "Shellfish",
            4: "Fruit",
            5: "Garlic",
            6: "Hot Peppers",
            7: "Oats",
            8: "Meat",
            9: "Milk",
            10: "Peanut",
            11: "Rice",
            12: "Sesame",
            13: "Soy",
            14: "Sulfites",
            15: "Tartrazine",
            16: "Tree Nut",
            17: "Wheat",
            18: "Tetracycline",
            19: "Dilantin",
            20: "Tegretol",
            21: "Penicillin",
            22: "Cephalosporins",
            23: "Sulfonamides",
            24: "Cromolyn",
            25: "Sodium",
            26: "Nedocromil",
            27: "Pollen",
            28: "Cat",
            29: "Dog",
            30: "Insect Sting",
            31: "Mold",
            32: "Perfume",
            33: "Cosmetics",
            34: "Latex",
            35: "Water",
            36: "Nickel",
            37: "Gold",
            38: "Chromium",
            39: "Cobalt Chloride",
            40: "Formaldehyde",
            41: "Photographic Developers",
            42: "Fungicide"
        },
    }
];

var ride_field_controls = [
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
