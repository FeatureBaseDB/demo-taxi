import time
import json
import requests
from itertools import product

from flask import Flask, Response, request, jsonify

### Config #############################
import ConfigParser
Config = ConfigParser.ConfigParser()
Config.read("demo.cfg")
section = "Base"
if section not in Config.sections():
    pilosahost = "http://localhost:15000"
    pilosadb = "db"
    host = "127.0.0.1"
    port = 5000
else:
    pilosahost = Config.get(section, 'pilosahost')
    pilosadb = Config.get(section, 'pilosadb')
    host = Config.get(section, 'host')
    port = Config.get(section, 'port')

section = "Predefined"
if section not in Config.sections():
    pct_thresh = 95.0
else:
    pct_thresh = float(Config.get(section, 'pct_thresh'))
########################################

app = Flask(__name__)

pilosa_hosts = [pilosahost]
db = pilosadb

settings = {'hosts': pilosa_hosts}
qurl = '%s/query?db=%s' % (pilosa_hosts[0], db)
pqurl = '%s/query?db=%s&profiles=true' % (pilosa_hosts[0], db)

# TODO complete this map
namemap = {
    'cab_type.n': {
        'Green': 0,
        'Yellow': 1,
    },
}

@app.route('/')
def index():
    return open('index.html', 'r').read()

@app.route('/assets/favicon.ico')
def icon():
    return Response(open('assets/favicon.ico', 'r').read(), mimetype='image/vnd.microsoft.icon')

@app.route('/assets/main.js')
def js():
    return Response(open('assets/main.js', 'r').read(), mimetype='application/javascript')

@app.route('/assets/plot.js')
def plot():
    return Response(open('assets/plot.js', 'r').read(), mimetype='application/javascript')

@app.route('/assets/main.css')
def css():
    return Response(open('assets/main.css', 'r').read(), mimetype='text/css')

@app.route('/assets/pilosa-logo.png')
def logo():
    return Response(open('assets/pilosa-logo.png', 'r').read(), mimetype='image/png')

@app.route("/profiles/count")
def count_profiles():
    result = {'count': get_profile_count()}
    return jsonify(result)


def get_profile_count():
    qs = ''
    bitmapIDs = range(10)
    for i in bitmapIDs:
        qs += 'Count(Bitmap(id=%s, frame=cab_type.n))' % i

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
        'query': format_intersect_query(bmps),
        'numProfiles': get_profile_count(),
    }
    return jsonify(result)

def format_intersect_query(bmps):
    return "Count(Intersect(<br />&nbsp;&nbsp;%s<br />))" % ',<br />&nbsp;&nbsp;'.join(bmps)


# there is a mapping bug that makes a few topn results look weird
# filter out large keys here, pending real fix
max_key_map = {
    'speed_mph.n': 100,
    'duration_minutes.n': 100,
    'dist_miles.n': 40,
    'totalAmount_dollars.n': 100,
}

@app.route("/query/topn")
def topn():
    frame = request.args['frame']
    if frame == '':
        return jsonify({'error': 'empty topn query'})

    t0 = time.time()
    q = "TopN(frame='%s')" % frame
    resp = requests.post(qurl, data=q)
    t1 = time.time()
    res = resp.json()['results'][0]

    max_key = max_key_map.get(frame, 1000000)
    rows = [{'bitmapID': c['key'], 'count': c['count']} for c in res if c['key'] < max_key]

    if 'Grid' in frame:
        add_grid_coords(rows)

    result = {
        'rows': rows,
        'seconds': t1-t0,
        'query': q,
        'numProfiles': get_profile_count(),
    }
    return jsonify(result)


def add_grid_coords(rows, key='bitmapID'):
    print(rows[0])
    for row in rows:
        row['x'] = row[key] % 100
        row['y'] = row[key] / 100


@app.route("/predefined/1")
def predefined1():
    # count per cab_type

    # create and post query
    t0 = time.time()
    qs = ''
    ctypes = range(10)
    for i in ctypes:
        qs += 'Count(Bitmap(id=%s, frame=cab_type.n))' % i

    resp = requests.post(qurl, data=qs)
    t1 = time.time()

    # compile results
    data = json.loads(resp.content)
    counts = data['results']
    rows = [{'cab_type': ctype, 'count': count} for ctype, count in zip(ctypes, counts) if count >0]
    result = {
        'rows': rows,
        'seconds': t1-t0,
        'description': 'Profile count by cab type (Mark #1)',
        'numProfiles': get_profile_count(),
    }
    print('predefined 1: %.2f sec' % (t1-t0))

    return jsonify(result)

@app.route("/predefined/2")
def predefined2():
    # avg(total_amount) per passenger_count
    # attribute aggregation might improve performance

    t0 = time.time()
    qs = ''
    pcounts = range(10)
    for i in pcounts:
        qs += "TopN(Bitmap(id=%d, frame='passenger_count.n'), frame=total_amount_dollars.n)" % i
    resp = requests.post(qurl, data=qs)
    t1 = time.time()

    rows = []
    for pcount, topn in zip(pcounts, resp.json()['results']):
        print('computing average for pcount=%d, %d vals' % (pcount, len(topn)))
        if not topn:
            continue
        wsum = sum([r['count'] * r['key'] for r in topn])
        count = sum([r['count'] for r in topn])
        rows.append({
            'passengerCount': pcount,
            'average(totalAmount)': float(wsum) / count,
        })

    result = {
        'rows': rows,
        'seconds': t1-t0,
        'description': 'average(total_amount) by passenger_count (Mark #2)',
        'numProfiles': get_profile_count(),
    }
    print('predefined 2: %.2f sec' % (t1-t0))
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
            "Bitmap(id=%d, frame='pickup_year.n')" % year,
            "Bitmap(id=%d, frame='passenger_count.n')" % pcount,
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
        'description': 'Profile count by (year, passenger_count) (Mark #3)',
        'numProfiles': get_profile_count(),
    }
    print('predefined 3: %.2f sec' % (t1-t0))

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
        "TopN(frame='pickup_year.n')"
        "TopN(frame='passenger_count.n')"
        "TopN(frame='dist_miles.n')"
    ]
    qs = ', '.join(topns)
    resp = requests.post(qurl, data=qs)
    res = json.loads(resp.content)['results']

    t1 = time.time()

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
    for year, pcount, dist, maxcount in cands:
        bmps = [
            "Bitmap(id=%d, frame='pickup_year.n')" % year,
            "Bitmap(id=%d, frame='passenger_count.n')" % pcount,
            "Bitmap(id=%d, frame='dist_miles.n')" % dist,
        ]
        q = "Count(Intersect(%s))" % ', '.join(bmps)
        resp = requests.post(qurl, data=q)
        count = json.loads(resp.content)['results'][0]
        total += count

        rows.append({
            'count': count,
            'distance': dist,
            'passenger_count': pcount,
            'pickup_year': year,
        })

        pct = (100.*total)/num_profiles
        print('%d. %.2f%% (max %.2f%%)' % (n, pct, pct_thresh))
        if pct >= pct_thresh:
            break

        n += 1

    rows.sort(key=lambda x: (-x['pickup_year'], -x['count']))

    t2 = time.time()
    result = {
        'percentageThreshold': pct_thresh,
        'rows': rows,
        'seconds': t2-t0,
        'description': 'Profile count by (year, passenger_count, trip_distance), ordered by (year, count) (Mark #4)',
        'numProfiles': get_profile_count(),
    }

    print('predefined 4: %.2f + %.2f = %.2f sec' % (t1-t0, t2-t1, t2-t0))

    return jsonify(result)

@app.route("/predefined/5")
def predefined5():
    # count of pickup locations for the top dropoff location
    t0 = time.time()
    q = "TopN(frame=drop_grid_id.n, n=1)"
    res = requests.post(qurl, data=q).json()['results'][0]
    top_dropoff_id = res[0]['key']
    q = "TopN(Bitmap(frame=drop_grid_id.n, id=%d), frame=pickup_grid_id.n)" % top_dropoff_id
    resp = requests.post(qurl, data=q)
    t1 = time.time()
    res = resp.json()['results'][0]

    key = 'pickup_grid_id'
    rows = [{key: r['key'], 'count': r['count']} for r in res]

    add_grid_coords(rows, key=key)

    result = {
        'rows': rows,
        'seconds': t1-t0,
        'description': 'Count of pickup locations for top dropoff location',
        'numProfiles': get_profile_count(),
    }

    return jsonify(result)




if __name__ == "__main__":
    app.run(host=host, port=port)
