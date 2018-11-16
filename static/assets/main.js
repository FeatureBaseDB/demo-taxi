var VERBOSITY = 5;

$("#intersectForm").bind('submit', function(event) {
    event.preventDefault();
    var query = makeIntersectTabQuery();
    if (!query) {
        log("No query.", 1);
        return
    }
    log("intersect query", 1);
    log(query, 1);
    doAjax('query', query, function(data) {
        if (data.error) {
            log("QError:" + data.error, 1);
            $('#intersectResults').hide();
        } else {
            $('#intersectResults').show();
            log("intersect query successful", 1);
        }
        $("#intersect-result-query").html(query);
        $("#intersect-result-latency").text(data['seconds'].toString().substring(0,5) + ' sec');
        $("#intersect-result-count").text(addCommas(data['rows'][0].count) + ' rides');
        $("#intersect-result-total").text(addCommas(data['numRides']) + ' total rides');
    });
});

$("#joinForm").bind('submit', function(event) {
    event.preventDefault();
    var req = makeJoinTabRequest();
    var req_disp = makeJoinTabDisp();
    if (!req["user_query"] || !req["ride_query"]) {
        log("Incomplete request.", 1);
        return
    }
    log("join query", 1)
    log(req, 1);
    $.ajax({
        url: "query/join",
        type: 'post',
        dataType: 'json',
        data: req,
        success: function(data) {
            log("join response", 2);
            log(data, 2);
            if (data.error) {
                log("QError: " + data.error, 1);
                $('#joinResults').hide();
            } else {
                $('#joinResultsPlaceholder').hide();
                $('#joinResults').show();
                log("join query successful", 1);
            }
            $("#join-result-user-query").html(req_disp["user_query"]);
            $("#join-result-ride-query").html(req_disp["ride_query"]);
            $("#join-result-latency").text(data['seconds'].toString().substring(0,5) + ' sec');
            $("#join-result-ride-count").text(addCommas(data['matchedRides']));
            $("#join-result-user-count").text(addCommas(data['matchedUsers']));
            $("#join-result-total-rides").text(addCommas(data['totalRides']));
            $("#join-result-total-users").text(addCommas(data['totalUsers']));
            clearPlot("#join-plot-container");
            if(data['rows'].length > 1 && 'count' in data['rows'][0]) {
                renderHistogram(data['rows'], "#join-plot-container");
                log("join histogram from " + data['rows'].length + " rows", 1);
            } else {
                log("no join data for histogram", 2);
            }
        },
    });
});


$("#topn").bind('submit', function(event) {
    event.preventDefault();
    $('#topnResults').hide()
    var data = $('#topNForm').serialize()
    doAjax('query/topn', data, function(data) {
        log(data, 2);
        if (data.error) {
            $('#topnResults').hide()
        } else {
            $('#topnResults').show()
        }
        $("#topn-result-query").text(data['query']);
        $("#topn-result-latency").text(data['seconds'].toString().substring(0,5) + ' sec');
        $("#topn-result-total").text(addCommas(data['numRides']) + ' total rides');

        var table = $('<table class="table"><thead><tr><th>Row ID</th><th>Count</th></tr></thead></table>');
        var tbody = $('<tbody></tbody>');
        $.each(data['rows'], function(index, obj) {
            tbody.append('<tr><td>' + obj.rowID + '</td><td>' + obj.count + '</td></tr>')
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
        log(data, 2);
        if (data.error) {
            $('#predefinedResults').hide()
        } else {
            $('#predefinedResults').show()
        }
        $("#predefined-result-description").text(data['description']);
        $("#predefined-result-latency").text(data['seconds'].toString().substring(0,5) + ' sec');
        $("#predefined-result-total").text(addCommas(data['numRides']) + ' total rides');

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
    log('renderHistogram enter', 5)
    if(Object.keys(rows[0]).length == 2) {
        keys = Object.keys(rows[0])
        for(var key in rows[0]) {
            if(key != "count") {
                xkey = key
            }
        }

        log(xkey, 5)
        // expects rows like [{xkey: 10, 'count': 100}, ...]
        hist1D(rows, xkey, selector)
    } else if('x' in rows[0] && 'y' in rows[0]) {
        // expects rows like [{'x': 30, 'y': 70, 'count': 100}, ...] 
        hist2D(rows, selector)
    }
}

function startup() {
    populate_version();
    populate_intersect_form();
    populate_join_form();
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

function populate_join_form() {
    log("populate join form", 1);
    tab = "join";
    el = $("#join-form-col");
    log("join form el[0].id: " + el[0].id, 6);
    width = 3;
    colID = 0;
    row = $('<div class="form-group row">');
    el.append("<div class='index-label'>User Index</div>")
    for (var n=0; n<user_field_controls.length; n++) {
        appendHR = false;
        if("row_seq" in user_field_controls[n]) {
            cell = create_cell_from_sequence(user_field_controls[n], tab);
        } else if ("row_map" in user_field_controls[n]) {
            cell = create_cell_from_map(user_field_controls[n], tab);
        } else if ("logo" in user_field_controls[n]) {
            cell = create_image(user_field_controls[n], tab);
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

    el.append('<hr><hr>');
    el.append("<div class='index-label'>Ride Index</div>")

    for (var n=0; n<ride_field_controls.length; n++) {
        appendHR = false;
        if("row_seq" in ride_field_controls[n]) {
            cell = create_cell_from_sequence(ride_field_controls[n], tab);
        } else if ("row_map" in ride_field_controls[n]) {
            cell = create_cell_from_map(ride_field_controls[n], tab);
        } else if ("logo" in ride_field_controls[n]) {
            cell = create_image(ride_field_controls[n], tab);
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

function populate_intersect_form() {
    log('populate intersect form', 1);
    tab = "intersect";
    el = $("#intersect-form-col");
    log("intersect form el[0].id:  " + el[0].id, 6);
    width = 3;
    colID = 0;
    row = $('<div class="form-group row">');
    for (var n=0; n<ride_field_controls.length; n++) {
        /*
          create something like this:
          <div class="col-sm-4">
            <label for="cab_type" class="col-form-label">Cab type</label>
            <select name="cab_type" form="intersectForm" class="intersect-field form-control" id="cab_type" onchange="$(this.form).trigger('submit')" multiple="multiple">
              <option></option>
              <option value="0">Green</option>
              <option value="1">Yellow</option>
            </select>
          </div>
        */

        appendHR = false;
        if("row_seq" in ride_field_controls[n]) {
            cell = create_cell_from_sequence(ride_field_controls[n], tab);
        } else if ("row_map" in ride_field_controls[n]) {
            cell = create_cell_from_map(ride_field_controls[n], tab);
        } else if ("logo" in ride_field_controls[n]) {
            cell = create_image(ride_field_controls[n], tab);
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

function create_image(field_control) {
    /*
      {
        logo: "/assets/nyc-opendata-logo.png",
        text: "NYC OpenData"
      },
    */
    div = $('<div class="col-sm-4">');
    $("<img>")
        .attr("src", field_control["logo"])
        .attr("class", "data-logo")
        .appendTo(div);

    return div;
}

function create_cell_from_map(field_control, tab) {
    /*
    {
        field: "pickup_day",
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
        .attr("for", field_control["field"])
        .attr("class", "col-form-label")
        .html(field_control["name"])
        .appendTo(div);
    sel = $("<select>")
        .attr("name", tab + "-" + field_control["field"])
        .attr("form", tab + "Form")
        .attr("class", tab + "-field form-control")
        .attr("id", tab + "-" + field_control["field"])
        .attr("onchange", "$(this.form).trigger('submit')")
        .attr("multiple", "multiple")
        .appendTo(div);

    sel.append($("<option>"));
    for(k in field_control['row_map']) {
        //log(k + " " + field_control['row_map'][k], 5);
        sel.append($("<option>", {value: k, text: field_control['row_map'][k]}));
    }
    return div;
}

function create_cell_from_sequence(field_control, tab) {
    /*
      ride_field_controls looks like this:
      {
        field: "temp_f",
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
        .attr("for", field_control["field"])
        .attr("class", "col-form-label")
        .html(field_control["name"])
        .appendTo(div);
    sel = $("<select>")
        .attr("name", tab + "-" + field_control["field"])
        .attr("form", tab + "Form")
        .attr("class", tab + "-field form-control")
        .attr("id", tab + "-" + field_control["field"])
        .attr("onchange", "$(this.form).trigger('submit')")
        .attr("multiple", "multiple")
        .appendTo(div);

    row_min = field_control['row_seq']['min'];
    row_max = field_control['row_seq']['max'];
    row_step = 1;
    if("step" in field_control['row_seq']) {
        row_step = field_control['row_seq']['step'];
    }
    num_elements = (row_max - row_min) / row_step + 1;

    if('val_seq' in field_control) {
        val_min = field_control['val_seq']['min'];
        val_max = field_control['val_seq']['max'];
    } else {
        val_min = row_min;
        val_max = row_max;
    }
    val_step = row_step * (val_max - val_min) / (row_max - row_min);
    log('val step: ' + val_step, 6);

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
    log("populate_topn_form", 1);
    el = $('#field');
    log("topn form el id: " + el[0].id, 5);
    for (n=0; n<ride_field_controls.length; n++) {
        if ("field" in ride_field_controls[n]) {
            el.append('<option value="' + ride_field_controls[n]['field']+ '">' + ride_field_controls[n]['name'] + '</option>');
            // log(ride_field_controls[n]['field'], 5);
        } else if ("logo" in ride_field_controls[n]) {
            el.append('<option disabled="disabled">----</option>');
        }
    }
}

var ride_fields = {
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
};

var user_fields = {
    "age": 0,
    "title": 1,
    "allergies": 2
};

function makeIntersectTabQuery() {
    return "Count(" + getIntersectQuery("intersect", ride_fields, "  ", "\n") + ")";
}

function makeJoinTabRequest() {
    return {
        "user_query": getIntersectQuery("join", user_fields, "", ""),
        "ride_query": getIntersectQuery("join", ride_fields, "", ""),
    };
}

function makeJoinTabDisp() {
    return {
        "user_query": getIntersectQuery("join", user_fields, "  ", "\n"),
        "ride_query": getIntersectQuery("join", ride_fields, "  ", "\n"),
    };
}

// TODO
function getRangeFieldPQL(el) {

}

function getStringFieldPQL(el) {

}

function getSetFieldPQL(el) {

}

function getIntersectQuery(tab, fields, indent, newline) {
    var toIntersect = [];
    for(var field in fields) {
        el = $("#" + tab + "-" + field);
        var val = el.val();
        if (!val) {
            continue;
        }
        var toUnion = [];
        if(field == "age") {
            if(val[0] == "" || val == [] || !val || val.length == 0) {
                // skip
            } else {
                ranges = rangify(val);
                toUnionR = [];
                for(var r=0; r<ranges.length; r++) {
                    log("current range: " + ranges[r], 6);
                    if(ranges[r][0] == ranges[r][1]) {
                        toUnionR.push("Range(" + field + "==" + ranges[r][0] + ")");
                    } else {
                        toUnionR.push("Range(" + ranges[r][0] + "<=" + field + "<=" + ranges[r][1] + ")");
                    }
                    log("range toUnion" + toUnionR, 6);
                }
                if(toUnionR.length == 1) {
                    toIntersect.push(indent + toUnionR[0]);
                } else {
                    toUnionR = toUnionR.join(", " + newline + indent + indent);
                    toIntersect.push(indent + "Union(" + newline + indent + indent + toUnionR + newline + indent + ")");
                }
            }
        } else {
            for (var i = 0; i < val.length; i++) {
                if (!val[i]) {
                    continue;
                }
                if(field == "title" || field == "allergies") {
                    id = user_fields[field];
                    q = "Row(" + field + "='" + user_field_controls[id]["row_map"][val[i]] + "')";
                } else {
                    q = "Row(" + field + "=" + val[i] + ")";
                }
                toUnion.push(indent + q);

            }
        }

        if (toUnion.length == 1) {
            toIntersect.push(toUnion[0]);
        }
        else if (toUnion.length > 1) {
            toIntersect.push(indent + "Union(" + newline + indent + toUnion.join("," + newline + indent) + newline + indent + ")");
        }
    }

    q = "";
    if (toIntersect.length > 0) {
        q = "Intersect(" + newline + toIntersect.join(", " + newline) + newline + ")";
    }
    return q;
}

function getIntersectQueryOld(tab, fields, indent, newline) {
    var toIntersect = [];
    for (var field in fields) {
        el = $("#" + tab + "-" + field);
        var val = el.val();
        if (!val) {
            continue;
        }
        var toUnion = [];
        for (var i = 0; i < val.length; i++) {
            if (!val[i]) {
                continue;
            }
            if(field == "title" || field == "allergies") {
                id = user_fields[field]
                q = "Row(" + field + "='" + user_field_controls[id]["row_map"][val[i]] + "')"
            } else {
                q = "Row(" + field + "=" + val[i] + ")"
            }
            toUnion.push(indent + q);
        }
        if (toUnion.length == 1) {
            toIntersect.push(toUnion[0]);
        }
        else if (toUnion.length > 1) {
            toIntersect.push(indent + "Union(" + newline + indent + toUnion.join("," + newline + indent) + newline + indent + ")");
        }

    }
    q = "";
    if (toIntersect.length > 0) {
        q = "Intersect(" + newline + toIntersect.join(", " + newline) + newline + ")";
    }
    return q;

}
