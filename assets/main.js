$("#intersect").click(function(event) {
    data = $('#intersectForm').serialize()
    getAndRenderRows('query/intersect', data)
});

$("#topn").click(function(event) {
    data = $('#topNForm').serialize()
    getAndRenderRows('query/topn', data)

});

$("#p1").click(function(event) {
    getAndRenderRows('predefined/1', "");
});

$("#p2").click(function(event) {
    getAndRenderRows('predefined/2', "");
});

$("#p3").click(function(event) {
    getAndRenderRows('predefined/3', "");
});

$("#p4").click(function(event) {
    getAndRenderRows('predefined/4', "");
});

$("#p5").click(function(event) {
    getAndRenderRows('predefined/5', "");
});


function getAndRenderRows(url, data) {
    $.ajax({
        url: url,
        type: 'get',
        dataType: 'json',
        data: data,
        success: function(data) {
            console.log(data)
            $("#time").text(data['seconds'].toString().substring(0,5) + ' sec');
            $("#description").text(data['description']);
            $("#profiles").text(data['numProfiles'] + ' total profiles');
        //renderResultsRaw(data['rows'])
        renderResultsAscii(data['rows']);

        if(data['rows'].length > 1) {
            renderHistogram(data['rows'])
        }
    }});
}

function renderResultsRaw(rows) {
    $("#results").text(JSON.stringify(rows));
}

function renderResultsAscii(rows) {
    str = ""
    for(var key in rows[0]) {
        str += key + " "
    }
    str += "\n"
    for(var n=0; n<rows.length; n++) {
        var line = ""
        for(var key in rows[n]) {
            line += rows[n][key] + " "
        }
        str += line + "\n"
    }

    $("#results").text(str)
}

function renderResultsDom(rows) {
// TODO populate some less ugly table rows
}

function renderHistogram(rows) {
    if(Object.keys(rows[0]).length == 2) {
        renderHistogram1D(rows)
    } else {
        renderHistogram2D(rows)
    }
}

function renderHistogram2D(rows) {
    // https://www.patrick-wied.at/static/heatmapjs/
    // http://tmroyal.github.io/Chart.HeatMap/
}

function renderHistogram1D(rows) {
    // rows is an array of objects with two keys, "count" contains y data, the other one contains x data
    var canvas = $("#canvas");
    canvas.removeClass('hidden');

    // figure out the key to use for x data
    keys = Object.keys(rows[0])
    for(var key in rows[0]) {
        if(key != "count") {
            xkey = key
        }
    }

    // sort rows by x value and create arrays
    rows.sort(function(a, b) {
        return a[xkey] - b[xkey];
    });
    x=[];
    y=[];
    for(var n=0; n<rows.length; n++) {
        x.push(rows[n][xkey])
        y.push(rows[n]['count'])
    }

    var myChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: x,
            datasets: [{
                label: xkey,
                data: y,
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                yAxes: [{
                    ticks: {
                        beginAtZero:true
                    }
                }]
            }
        }
    });
}

function startup() {
}