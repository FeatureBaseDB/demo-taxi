import time
import json
import requests
from itertools import product

from flask import Flask, Response, request, jsonify

app = Flask(__name__)

pilosa_host = 'http://localhost:15000'
db = 'taxi4'
qurl = '%s/query?db=%s' % (pilosa_host, db)
pqurl = '%s/query?db=%s&profiles=true' % (pilosa_host, db)

# TODO complete this map
namemap = {
    'cabType': {
        'Green': 1,
        'Yellow': 2,
    },
}

@app.route('/')
def index():
    return open('index.html', 'r').read()

@app.route('/favicon.ico')
def icon():
    return Response(open('assets/favicon.ico', 'r').read(), mimetype='image/vnd.microsoft.icon')

@app.route('/assets/main.js')
def js():
    return Response(open('assets/main.js', 'r').read(), mimetype='application/javascript')

@app.route('/assets/main.css')
def css():
    return Response(open('assets/main.css', 'r').read(), mimetype='text/css')

@app.route("/profiles/count")
def count_profiles():
    result = {'count': get_profile_count()}
    return jsonify(result)


def get_profile_count():
    qs = ''
    bitmapIDs = range(10)
    for i in bitmapIDs:
        qs += 'Count(Bitmap(id=%s, frame=cabType))' % i

    resp = requests.post(qurl, data=qs)
    data = json.loads(resp.content)
    counts = data['results']
    return sum(counts)


@app.route("/query/intersect")
def intersect():
    # expect dict like {framename: bitmapid} or {framename: bitmapname}
    # e.g. /query/intersect?year=2013&passengerCount=4
    frame_ids = request.args

    t0 = time.time()
    bmps = []
    for frame, bitmap in frame_ids.items():
        if bitmap == '':
            continue
        try:
            bitmapid = int(bitmap)
        except:
            bitmapid = namemap[frame][bitmap]

        bmps.append("Bitmap(id=%d, frame='%s')" % (bitmapid, frame))

    q = "Count(Intersect(%s))" % ', '.join(bmps)
    print(q)

    if bmps == []:
        # avoid server crash
        print('empty intersect query!')
        return jsonify({'error': 'empty intersect query'})

    resp = requests.post(qurl, data=q)
    t1 = time.time()

    # compile results
    data = json.loads(resp.content)
    counts = data['results']
    result = {
        'rows': [{'count': sum(counts)}],
        'seconds': t1-t0,
        'description': q,
        'numProfiles': get_profile_count(),
    }
    return jsonify(result)

@app.route("/query/topn")
def topn():
    frame = request.args['frame']

    t0 = time.time()
    q = "TopN(frame='%s')" % frame
    resp = requests.post(qurl, data=q)
    t1 = time.time()
    res = json.loads(resp.content)['results'][0]

    rows = [{'bitmapID': c['key'], 'count': c['count']} for c in res]

    if 'Grid' in frame:
        for row in rows:
            row['x'] = row['key'] % 100
            row['y'] = row['key'] / 100

    result = {
        'rows': rows,
        'seconds': t1-t0,
        'description': q,
        'numProfiles': get_profile_count(),
    }
    return jsonify(result)


@app.route("/predefined/1")
def predefined1():
    # count per cab_type

    # create and post query
    t0 = time.time()
    qs = ''
    ctypes = range(10)
    for i in ctypes:
        qs += 'Count(Bitmap(id=%s, frame=cabType))' % i

    resp = requests.post(qurl, data=qs)
    t1 = time.time()

    # compile results
    data = json.loads(resp.content)
    counts = data['results']
    rows = [{'cabType': ctype, 'count': count} for ctype, count in zip(ctypes, counts) if count >0]
    result = {
        'rows': rows,
        'seconds': t1-t0,
        'description': 'Profile count by cab type (Mark #1)',
        'numProfiles': get_profile_count(),
    }

    return jsonify(result)

@app.route("/predefined/2")
def predefined2():
    # avg(total_amount) per passenger_count
    # requires attribute aggregation for good performance

    t0 = time.time()

    t1 = time.time()
    rows = []
    result = {
        'rows': rows,
        'seconds': t1-t0,
        'description': 'average(totalAmount) by passengerCount (Mark #2)',
        'numProfiles': get_profile_count(),
    }
    return jsonify(result)

@app.route("/predefined/3")
def predefined3():
    # count per (passenger_count, year)

    # build and execute query
    t0 = time.time()
    qs = ''
    years = range(2009, 2016)
    pcounts = range(1, 7)

    pairs = list(product(years, pcounts))
    for year, pcount in pairs:
        bmps = [
            "Bitmap(id=%d, frame='pickupYear')" % year,
            "Bitmap(id=%d, frame='passengerCount')" % pcount,
        ]
        qs += "Count(Intersect(%s))" % ', '.join(bmps)

    resp = requests.post(qurl, data=qs)
    t1 = time.time()

    # compile results
    data = json.loads(resp.content)
    rows = []
    for count, (year, pcount) in zip(data['results'], pairs):
        if count == 0:
            continue
        rows.append({
            'count': count,
            'year': year,
            'passengerCount': pcount,
        })

    result = {
        'rows': rows,
        'seconds': t1-t0,
        'description': 'Profile count by (year, passengerCount) (Mark #3)',
        'numProfiles': get_profile_count(),
    }

    return jsonify(result)


@app.route("/predefined/4")
def predefined4():
    # count per (passenger_count, year, round(trip_distance)) order by (year, count)

    t0 = time.time()
    num_profiles = get_profile_count()

    years = range(2009, 2016)
    pcounts = range(1, 7)
    dists = range(50)

    topns = [
        "TopN(frame='pickupYear')"
        "TopN(frame='passengerCount')"
        "TopN(frame='dist_miles')"
    ]
    qs = ', '.join(topns)
    resp = requests.post(qurl, data=qs)
    res = json.loads(resp.content)['results']

    # assemble TopN results into candidates
    year_keycounts = [(x['key'], x['count']) for x in res[0]]
    pcount_keycounts = [(x['key'], x['count']) for x in res[1]]
    dist_keycounts = [(x['key'], x['count']) for x in res[2]]

    cands = []
    for (year_key, year_count), (pcount_key, pcount_count), (dist_key, dist_count) in product(year_keycounts, pcount_keycounts, dist_keycounts):
        cands.append([year_key, pcount_key, dist_key, min([year_count, pcount_count, dist_count])])

    # iterate over these in order of estimated largest maxcount
    cands.sort(key=lambda x: -x[3])
    lastprint = time.time()
    n = 0
    total = 0
    rows = []
    pct_thresh = 95.0
    for year, pcount, dist, maxcount in cands:
        bmps = [
            "Bitmap(id=%d, frame='pickupYear')" % year,
            "Bitmap(id=%d, frame='passengerCount')" % pcount,
            "Bitmap(id=%d, frame='dist_miles')" % dist,
        ]
        q = "Count(Intersect(%s))" % ', '.join(bmps)
        resp = requests.post(qurl, data=q)
        count = json.loads(resp.content)['results'][0]
        total += count

        rows.append({
            'count': count,
            'distance': dist,
            'passengerCount': pcount,
            'pickupYear': year,
        })

        pct = (100.*total)/num_profiles
        if pct >= pct_thresh:
            break

    rows.sort(key=lambda x: -x['count'])

    t1 = time.time()
    result = {
        'percentageThreshold': pct_thresh,
        'rows': rows,
        'seconds': t1-t0,
        'description': 'Profile count by (year, passengerCount, tripDistance), ordered by (year, count) (Mark #4)',
        'numProfiles': get_profile_count(),
    }

    return jsonify(result)



if __name__ == "__main__":
    app.run()
