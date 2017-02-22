$("#intersectForm").bind('submit', function(event) {
    event.preventDefault();
    data = $('#intersectForm').serialize()
    doAjax('query/intersect', data, function(data) {
        console.log(data);
        if (data.error) {
            $('#intersectResults').hide()
        } else {
            $('#intersectResults').show()
        }
        $("#intersect-result-query").html(data['query']);
        $("#intersect-result-latency").text(data['seconds'].toString().substring(0,5) + ' sec');
        $("#intersect-result-count").text(addCommas(data['rows'][0].count) + ' profiles');
        $("#intersect-result-total").text(addCommas(data['numProfiles']) + ' total profiles');
    });
});

$("#topn").bind('submit', function(event) {
    event.preventDefault();
    $('#topnResults').hide()
    var data = $('#topNForm').serialize()
    doAjax('query/topn', data, function(data) {
        console.log(data);
        if (data.error) {
            $('#topnResults').hide()
        } else {
            $('#topnResults').show()
        }
        $("#topn-result-query").text(data['query']);
        $("#topn-result-latency").text(data['seconds'].toString().substring(0,5) + ' sec');
        $("#topn-result-total").text(addCommas(data['numProfiles']) + ' total profiles');

        var table = $('<table class="table"><thead><tr><th>Bitmap ID</th><th>Count</th></tr></thead></table>');
        var tbody = $('<tbody></tbody>');
        $.each(data['rows'], function(index, obj) {
            tbody.append('<tr><td>' + obj.bitmapID + '</td><td>' + obj.count + '</td></tr>')
        });
        table.append(tbody);
        $("#topn-result-table").html(table);

        clearTopNCanvas();
        renderHistogram('#topn-canvas', data['rows']);
    });
});

function clearTopNCanvas() {
    $("#topn-canvas").remove();
    $("#chartjs-hidden-iframe").remove();
    $("#topn-canvas-container").append("<canvas id='topn-canvas' width='200' height='200'>");
}

function clearPredefinedCanvas() {
    $("#predefined-canvas").remove();
    $("#chartjs-hidden-iframe").remove();
    $("#predefined-canvas-container").append("<canvas id='predefined-canvas' width='200' height='200'>");
}

$("#p1").click(function(event) {
    predefined('predefined/1', "");
});

$("#p2").click(function(event) {
    predefined('predefined/2', "");
});

$("#p3").click(function(event) {
    predefined('predefined/3', "");
});

$("#p4").click(function(event) {
    predefined('predefined/4', "");
});

$("#p5").click(function(event) {
    predefined('predefined/5', "");
});

function predefined(url, data) {
    $('#predefinedResults').hide()
    return doAjax(url, data, function(data) {
        console.log(data);
        if (data.error) {
            $('#predefinedResults').hide()
        } else {
            $('#predefinedResults').show()
        }
        $("#predefined-result-description").text(data['description']);
        $("#predefined-result-latency").text(data['seconds'].toString().substring(0,5) + ' sec');
        $("#predefined-result-total").text(addCommas(data['numProfiles']) + ' total profiles');

        var header = [];
        var table = $('<table class="table"></table>');
        var theadtr = $('<tr></tr>')
        $.each(data['rows'][0], function(key) {
            header.push(key);
            theadtr.append($('<th>' + key + '</th>'));
        });
        var thead = $('<thead></thead>');
        thead.append(theadtr);
        table.append(thead);
        var tbody = $('<tbody></tbody>');
        $.each(data['rows'], function(index, row) {
            var tr = $('<tr></tr>');
            $.each(header, function(_, key) {
                tr.append($('<td>' + row[key] + '</td>'));
            });
            tbody.append(tr);
        });
        table.append(tbody);
        $("#predefined-result-table").html(table);

        clearPredefinedCanvas();
        if(data['rows'].length > 1) {
            renderHistogram('#predefined-canvas', data['rows']);
        }
    });
}

function doAjax(url, data, callback) {
    $.ajax({
        url: url,
        type: 'get',
        dataType: 'json',
        data: data,
        success: callback,
    });
}
function getAndRenderRows(url, data) {
    $.ajax({
        url: url,
        type: 'get',
        dataType: 'json',
        data: data,
        success: function(data) {
            console.log(data)
            $("#time").text(data['seconds'].toString().substring(0,5) + ' sec');
            $("#description").html(data['description']);
            $("#profiles").text(data['numProfiles'] + ' total profiles');
        //renderResultsRaw(data['rows'])
        renderResultsAscii(data['rows']);

        clearCanvas();

        if(data['rows'].length > 1) {
            renderHistogram(data['rows']);
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

function renderHistogram(canvas, rows) {
    if(Object.keys(rows[0]).length == 2) {
        renderHistogram1D(canvas, rows)
    } else {
        renderHistogram2D(canvas, rows)
    }
}

function renderHistogram2D(canvas, rows) {
    // https://www.patrick-wied.at/static/heatmapjs/
    // http://tmroyal.github.io/Chart.HeatMap/
}

function renderHistogram1D(canvas, rows) {
    // rows is an array of objects with two keys, "count" contains y data, the other one contains x data
    var canvas = $(canvas);
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

function addCommas(intNum) {
    return (intNum + '').replace(/(\d)(?=(\d{3})+$)/g, '$1,');
}

function startup() {
}
