function pretty_print_pql(pql, indent) {
  // TODO
  // just add newline+indent when a "(" is encountered, tracking depth
}

function log(m, v) {
    if(v <= VERBOSITY) {
        console.log(m);
    }
}


function addCommas(intNum) {
    return (intNum + '').replace(/(\d)(?=(\d{3})+$)/g, '$1,');
}


function rangify(vals) {
    // convert list of ints to list of ranges
    // [2, 3, 4, 5, 6, 10, 14, 15, 16, 20] -> [[2, 6], [10], [14, 16], [20]]
    ranges = [];
    if(vals.length == 0) {
        return ranges;
    }
    range = [parseInt(vals[0]), parseInt(vals[0])];
    for(var i=1; i<vals.length; i++) {
        if(parseInt(vals[i]) == range[1]+1) {
            range[1] = parseInt(vals[i]);
        } else {
            ranges.push(range);
            range = [parseInt(vals[i]), parseInt(vals[i])];
        }
    }
    ranges.push(range);
    return ranges;
}

function test_rangify() {
    inp = [2, 3, 4, 5, 6, 10, 14, 15, 16, 20, 21];
    exp = [[2, 6], [10, 10], [14, 16], [20, 21]];
    inp = [0, 1];
    exp = [[0, 1]];
    console.log(inp);
    console.log(rangify(inp));
    console.log(exp);
}

// test_rangify();
