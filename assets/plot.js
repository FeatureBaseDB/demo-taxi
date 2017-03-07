function hist1D(d, xkey, selector) {
    console.log("hist1d enter")
    var margin = {top: 20, right: 90, bottom: 25, left: 70},
        width = 470 - margin.left - margin.right,
        height = 400 - margin.top - margin.bottom;

    // define scales
    x = d3.scale.linear().range([0, width]);
    var y = d3.scale.linear().range([height, 0]);
    x.domain([d3.min(d, function(d) {return d[xkey]; }), d3.max(d, function(d) {return d[xkey]; })])
    y.domain([0, d3.max(d, function(d) { return d.count; })]);

    var barWidth = width / (x.domain()[1] - x.domain()[0]);

    // create svg element
    var svg = d3.select(selector).append('svg')
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.svg.axis().scale(x).orient("bottom"));

    svg.append("g")
        .attr("class", "y axis")
        .call(d3.svg.axis().scale(y).orient("left"));

    svg.selectAll(".bar")
        .data(d)
        .enter().append("rect")
        .style("fill", "steelblue")
        .attr("class", "bar")
        .attr("x", function(d) { return x(d[xkey]); })
        .attr("width", barWidth-1)
        .attr("y", function(d) { return y(d.count); })
        .attr("height", function(d) { return height - y(d.count); });

    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.svg.axis().scale(x).orient("bottom"))
        .append("text")
        .attr("class", "label")
        .attr("x", width)
        .attr("y", -6)
        .attr("text-anchor", "end")
        .text("Bitmap ID");

    // Add a y-axis with label.
    svg.append("g")
        .attr("class", "y axis")
        .call(d3.svg.axis().scale(y).orient("left"))
        .append("text")
        .attr("class", "label")
        .attr("y", 6)
        .attr("dy", ".71em")
        .attr("text-anchor", "end")
        .attr("transform", "rotate(-90)")
        .text("Count");
}


function hist2D(d, selector) {
    console.log("hist2D enter")

    var margin = {top: 20, right: 90, bottom: 25, left: 25},
        width = 470 - margin.left - margin.right,
        height = 400 - margin.top - margin.bottom;

    // TODO fix scales to use log10 properly
    var x = d3.scale.linear().range([0, width]),
        y = d3.scale.linear().range([height, 0]),
        z = d3.scaleSequential(d3.interpolateViridis)
    //z = d3.scale.linear().range(["white", "steelblue"]);
    //z = d3.scale.log().base(10).range(["white", "steelblue"]);

    // The size of the buckets in the CSV data file.
    // This could be inferred from the data if it weren't sparse.
    var xStep = 1,
        yStep = 1;

    var svg = d3.select(selector).append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    console.log(selector)
    console.log(svg)

    // Compute the scale domains.
    x.domain(d3.extent(d, function(r) { return r.x; }));
    y.domain(d3.extent(d, function(r) { return r.y; }));
    //z.domain([0, d3.max(d, function(r) { return r.count; })]);
    z.domain([0, Math.log10(d3.max(d, function(r) { return r.count;}))]); // TODO this is not the right way to use log

    // Extend the x- and y-domain to fit the last bucket.
    // For example, the y-bucket 3200 corresponds to values [3da200, 3300].
    x.domain([x.domain()[0], +x.domain()[1] + xStep]);
    y.domain([y.domain()[0], y.domain()[1] + yStep]);

    // Display the tiles for each non-zero bucket.
    // See http://bl.ocks.org/3074470 for an alternative implementation.
    svg.selectAll(".tile")
        .data(d)
        .enter().append("rect")
        .attr("class", "tile")
        .attr("x", function(d) { return x(d.y); })
        .attr("y", function(d) { return y(d.x + yStep); })
        .attr("width", x(xStep) - x(0))
        .attr("height",  y(0) - y(yStep))
        .style("fill", function(d) { return z(Math.log10(d.count)); }); // TODO also not right way to use log

    // Add a legend for the color values.
    var legend = svg.selectAll(".legend")
            .data(z.ticks(Math.ceil(z.domain()[1])+1).reverse())
            .enter().append("g")
            .attr("class", "legend")
            .attr("transform", function(d, i) { return "translate(" + (width + 20) + "," + (20 + i * 20) + ")"; });

    legend.append("rect")
        .attr("width", 20)
        .attr("height", 20)
        .style("fill", z);

    legend.append("text")
        .attr("x", 26)
        .attr("y", 10)
        .attr("dy", ".35em")
        .text(function(d) { return Math.pow(10, d); });

    svg.append("text")
        .attr("class", "label")
        .attr("x", width + 20)
        .attr("y", 10)
        .attr("dy", ".35em")
        .text("Count");

    // Add an x-axis with label.
    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.svg.axis().scale(x).orient("bottom"))
        .append("text")
        .attr("class", "label")
        .attr("x", width)
        .attr("y", -6)
        .attr("text-anchor", "end")
        .text("Longitude bin");

    // Add a y-axis with label.
    svg.append("g")
        .attr("class", "y axis")
        .call(d3.svg.axis().scale(y).orient("left"))
        .append("text")
        .attr("class", "label")
        .attr("y", 6)
        .attr("dy", ".71em")
        .attr("text-anchor", "end")
        .attr("transform", "rotate(-90)")
        .text("Latitude bin");

}
