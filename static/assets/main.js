$("#intersectForm").bind('submit', function(event) {
    event.preventDefault();
    var query = makeIntersectQuery();
    if (!query) {
        console.log("No query.");
        return
    }
    console.log("Q", query);
    doAjax('query', query, function(data) {
        if (data.error) {
            console.log("QError", data.error);
            $('#intersectResults').hide();
        } else {
            $('#intersectResults').show();
        }
        $("#intersect-result-query").html(query);
        $("#intersect-result-latency").text(data['seconds'].toString().substring(0,5) + ' sec');
        $("#intersect-result-count").text(addCommas(data['rows'][0].count) + ' rides');
        $("#intersect-result-total").text(addCommas(data['numProfiles']) + ' total rides');
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
        $("#topn-result-total").text(addCommas(data['numProfiles']) + ' total rides');

        var table = $('<table class="table"><thead><tr><th>Bitmap ID</th><th>Count</th></tr></thead></table>');
        var tbody = $('<tbody></tbody>');
        $.each(data['rows'], function(index, obj) {
            tbody.append('<tr><td>' + obj.bitmapID + '</td><td>' + obj.count + '</td></tr>')
        });
        table.append(tbody);
        $("#topn-result-table").html(table);

        clearPlot("#topn-plot-container");
        if(data['rows'].length > 1 && 'count' in data['rows'][0]) {
            renderHistogram(data['rows'], "#topn-plot-container");
        }

    });
});

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
        $("#predefined-result-total").text(addCommas(data['numProfiles']) + ' total rides');

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

        clearPlot("#predefined-plot-container");        
        if(data['rows'].length > 1 && 'count' in data['rows'][0]) {
            renderHistogram(data['rows'], "#predefined-plot-container");
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

function clearPlot(selector) {
    $(selector+" svg").remove()
}

function renderHistogram(rows, selector) {
    console.log('renderHistogram enter')
    if(Object.keys(rows[0]).length == 2) {
        keys = Object.keys(rows[0])
        for(var key in rows[0]) {
            if(key != "count") {
                xkey = key
            }
        }

        console.log(xkey)
        // expects rows like [{xkey: 10, 'count': 100}, ...]
        hist1D(rows, xkey, selector)
    } else if('x' in rows[0] && 'y' in rows[0]) {
        // expects rows like [{'x': 30, 'y': 70, 'count': 100}, ...] 
        hist2D(rows, selector)
    }
}

function addCommas(intNum) {
    return (intNum + '').replace(/(\d)(?=(\d{3})+$)/g, '$1,');
}

function startup() {
    populate_version();
    populate_intersect_form();
    populate_topn_form();
}

function populate_version() {
  var xhr = new XMLHttpRequest();
    xhr.open('GET', '/version')
    var node = document.getElementById('version-info')

    xhr.onload = function() {
      data = JSON.parse(xhr.responseText)
      node.innerHTML = "server: " + data['pilosaversion'] + "<br />demo: " + data['demoversion']
    }
    xhr.send(null)
}

function populate_intersect_form() {
    el = $("#intersect-form-col");
    console.log(el);
    width = 3;
    colID = 0;
    row = $('<div class="form-group row">');
    for (var n=0; n<frame_controls.length; n++) {
        /*
          create something like this:
          <div class="col-sm-4">
            <label for="cab_type" class="col-form-label">Cab type</label>
            <select name="cab_type" form="intersectForm" class="intersect-frame form-control" id="cab_type" onchange="$(this.form).trigger('submit')" multiple="multiple">
              <option></option>
              <option value="0">Green</option>
              <option value="1">Yellow</option>
            </select>
          </div>
        */

        appendHR = false;
        if("row_seq" in frame_controls[n]) {
            cell = create_cell_from_sequence(frame_controls[n]);
        } else if ("row_map" in frame_controls[n]) {
            cell = create_cell_from_map(frame_controls[n]);
        } else if ("logo" in frame_controls[n]) {
            cell = create_image(frame_controls[n]);
            appendHR = true;
        }
        row.append(cell);
        colID++;

        if(colID == width) {
            /*
            group things into 3 columns in each row
            <div class="form-group row">
            </div>
            */
            colID = 0;
            el.append(row);
            if(appendHR) {
                el.append('<hr>');
            }
            row = $('<div class="form-group row">');
        }
    }
}

function create_image(frame_control) {
    /*
      {
        logo: "/assets/nyc-opendata-logo.png",
        text: "NYC OpenData"
      },
    */
    div = $('<div class="col-sm-4">');
    $("<img>")
        .attr("src", frame_control["logo"])
        .attr("class", "data-logo")
        .appendTo(div);

    return div;
}

function create_cell_from_map(frame_control) {
    /*
    {
        frame: "pickup_day",
        group: "nyc-opendata",
        name: "Pickup weekday",
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
    */

    div = $('<div class="col-sm-4">');
    label = $("<label>")
        .attr("for", frame_control["frame"])
        .attr("class", "col-form-label")
        .html(frame_control["name"])
        .appendTo(div);
    sel = $("<select>")
        .attr("name", frame_control["frame"])
        .attr("form", "intersectForm")
        .attr("class", "intersect-frame form-control")
        .attr("id", frame_control["frame"])
        .attr("onchange", "$(this.form).trigger('submit')")
        .attr("multiple", "multiple")
        .appendTo(div);

    sel.append($("<option>"));
    for(k in frame_control['row_map']) {
        //console.log(k, frame_control['row_map'][k]);
        sel.append($("<option>", {value: k, text: frame_control['row_map'][k]}));
    }
    return div;
}

function create_cell_from_sequence(frame_control) {
    /*
      frame_controls looks like this:
      {
        frame: "temp_f",
        group: "weather",
        name: "Temperature",
        row_seq: {
          min: 160,
          max: 238,
          step: 2
        },
        val_seq: {
          min: 50,
          max: 99
        },
        suffix: "°F"
      },
    */
    div = $('<div class="col-sm-4">');
    label = $("<label>")
        .attr("for", frame_control["frame"])
        .attr("class", "col-form-label")
        .html(frame_control["name"])
        .appendTo(div);
    sel = $("<select>")
        .attr("name", frame_control["frame"])
        .attr("form", "intersectForm")
        .attr("class", "intersect-frame form-control")
        .attr("id", frame_control["frame"])
        .attr("onchange", "$(this.form).trigger('submit')")
        .attr("multiple", "multiple")
        .appendTo(div);

    row_min = frame_control['row_seq']['min'];
    row_max = frame_control['row_seq']['max'];
    row_step = 1;
    if("step" in frame_control['row_seq']) {
        row_step = frame_control['row_seq']['step'];
    }
    num_elements = (row_max - row_min) / row_step + 1;

    if('val_seq' in frame_control) {
        val_min = frame_control['val_seq']['min'];
        val_max = frame_control['val_seq']['max'];
    } else {
        val_min = row_min;
        val_max = row_max;
    }
    val_step = row_step * (val_max - val_min) / (row_max - row_min);
    console.log('val step: ' + val_step);

    sel.append($("<option>"));
    for(n=0; n<num_elements; n++) {
        pilosa_row = row_min + n * row_step;
        value = val_min + n * val_step;
        value = Math.round(value * 100) / 100;
        sel.append($("<option>", {value: pilosa_row, text: value}));
    }

    return div;
}


function populate_topn_form() {
    console.log("populate_topn_form");
    el = $('#frame');
    console.log(el);
    for (n=0; n<frame_controls.length; n++) {
        if ("frame" in frame_controls[n]) {
            el.append('<option value="' + frame_controls[n]['frame']+ '">' + frame_controls[n]['name'] + '</option>');
            console.log(frame_controls[n]['frame']);
        } else if ("logo" in frame_controls[n]) {
            el.append('<option disabled="disabled">----</option>');
        }
    }
}

var frames = {
    cab_type: 0,
    pickup_year: 0,
    pickup_month: 0,
    pickup_day: 0,
    pickup_time: 0,
    dist_miles: 0,
    duration_minutes: 0,
    speed_mph: 0,
    passenger_count: 0,
    total_amount_dollars: 0,
    weather_condition: 0,
    temp_f: 0,
    precipitation_inches: 0,
    // precipitation_type: 0,
    pressure_i: 0,
    humidity: 0,
    pickup_elevation: 0,
    drop_elevation: 0,
}


function makeIntersectQuery() {
    indent = "  "
    var toIntersect = [];
    var frame_els = $(".intersect-frame")  // TODO should be able to use this instead of frames dict
    for (var frame in frames) {
        el = $("#" + frame);
        var val = el.val();
        if (!val) {
            continue;
        }
        var toUnion = [];
        for (var i = 0; i < val.length; i++) {
            if (!val[i]) {
                continue;
            }            
            toUnion.push(indent + "Bitmap(frame='" + frame + "',rowID=" + val[i] + ")");
        }
        if (toUnion.length == 1) {
            toIntersect.push(toUnion[0]);
        }
        else if (toUnion.length > 1) {
            toIntersect.push(indent + "Union(\n" + indent+ toUnion.join(",\n" + indent) + "\n" + indent + ")");
        }
        
    }
    if (toIntersect.length > 0) {
        return "Count(Intersect(\n" + toIntersect.join(", \n") + "\n))";
    }
    return "";
}
