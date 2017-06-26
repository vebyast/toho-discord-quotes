var QUOTEDB_DOCUMENTS = null;
var QUOTEDB_MAP = null;
var idx = null;
var search_results_vue = null;

const TRUNCATE_LENGTH = 25;
const RESULTS_PER_PAGE = 10;

// set up routing
var router = new Navigo(null, true);
router
	.on('/search/:query', function(params, get) {
		var search_query = decodeURIComponent(params.query);
		display_from_query(search_query);
	})
	.on('/quote_id/:quote_id', function(params) {
		var id = params.quote_id;
		display_from_id(id);
	})
	.on('/starting_at/:start', function(params) {
		var time = new Date(params.start);
		display_from_time({time});
	})
	.on(function(params) {
		display_all();
	});

// set up vue and then 'refresh'
$(document).ready(function() {
	search_results_vue = new Vue({
		el: '#search_results',
		data: {
			search_results: [],
			timeinterval_start: null,
		}
	});
	// grab the quotes json, set up lunr, and finally start start working
	$.getJSON('quotes.json', function(json) {
		load_db(json);
		reindex();
		router.resolve();
	});
});

// set up a key event so hitting 'enter' on the searchbox executes a search
$(document).ready(function() {
	$('#search_query_box').keypress(function(e) {
        if (e.keyCode == 13) {
			$('#search_query_submit_button').click();
			return false;
		};
	});
});

// create the quotes database and lunr index from the given object, which should
// be an array of quote objects
function reindex() {
	idx = lunr(function () {
		this.ref('id');
		this.field('lines');
		this.field('authors');

		QUOTEDB_DOCUMENTS.forEach(function (doc) {
			this.add({
				'id': doc['id'],
				'lines': doc['lines'].map(function (line) { return line['content'] }).join(' '),
				'authors': doc['lines'].map(function (line) { return line['author'] }),
			});
		}, this);
	});
};

function load_db(json) {
	QUOTEDB_DOCUMENTS = json;

	QUOTEDB_MAP = {};
	QUOTEDB_DOCUMENTS.forEach(function (doc) {
		QUOTEDB_MAP[doc['id']] = doc;
		doc['quoted'] = new Date(doc['quoted']);
		doc['lines'].forEach(function (line) {
			line['timestamp'] = new Date(line['timestamp']);
		});
	});
	QUOTEDB_DOCUMENTS.sort(function(a, b) {
		// put largest (most recent) timestamps first
		return b['quoted'] - a['quoted'];
	});
}

// pagination - move to newer quotes
function newer_page_button_onclick() {
	var current_end = search_results_vue.timeinterval_end;
	var before = QUOTEDB_DOCUMENTS.filter(function (quote) {
		return quote['quoted'] > current_end;
	});
	if (before.length == 0) {
		return;
	};
	var end_idx = Math.max(0, before.length - RESULTS_PER_PAGE);
	var new_end = before[end_idx]['quoted'];
	router.navigate('/starting_at/' + fixedEncodeURIComponent(new_end.toISOString()));
};

// pagination - move to older quotes
function older_page_button_onclick() {
	var new_end = search_results_vue.timeinterval_start;
	router.navigate('/starting_at/' + fixedEncodeURIComponent(new_end.toISOString()));
};

// if we have a query in the box, go to do a query. if the box is empty, go to
// show all results.
function search_button_onclick() {
	var query = $('#search_query_box').val();
	if (query) {
		router.navigate('/search/' + fixedEncodeURIComponent(query));
	}
	else {
		router.navigate('');
	};
};

// update vue to display a single quote identified by its ID
function display_from_id(id) {
	if (id in QUOTEDB_MAP) {
		var result_documents = [QUOTEDB_MAP[id]];
		update_search_results_vue({result_documents, truncate: false});
	};
};

// update vue to display 'all' quotes, which ius really the ten most recently
// uploaded
function display_all() {
	var result_documents = QUOTEDB_DOCUMENTS;
	result_documents = result_documents.slice(0, RESULTS_PER_PAGE);
	update_search_results_vue({result_documents, truncate: true});
};

// update vue to display quotes in a date range
function display_from_time({time}) {
	var result_documents = QUOTEDB_DOCUMENTS;
	result_documents = result_documents.filter(function(quote) {
		return (time >= quote['quoted']);
	});
	result_documents = result_documents.slice(0, RESULTS_PER_PAGE);
	update_search_results_vue({result_documents, truncate: true});
}

// update vue to display results that match the given lunr query
function display_from_query(query) {
	if (!idx) { return; };
	var result_documents = search_quote_db(query);
	update_search_results_vue({result_documents, truncate: true});
};

// do a search against lunr and return the set of documents that results
function search_quote_db(query) {
	var results = idx.search(query);
	// sort from largest score to smallest score to sort relevant results first
	results.sort(function(a, b) {
		return b['score'] - a['score'];
	});
	var result_documents = results.map(function(sr) {
		return QUOTEDB_MAP[sr.ref];
	});

	return result_documents;
};

// update vue with the data for the current set of documents
function update_search_results_vue({result_documents, truncate=false}) {
	if (!search_results_vue) { return; };

	var result_output = result_documents.map(function(sr) {
		var lines = [];
		var truncated = 0;
		if (truncate && sr['lines'].length > TRUNCATE_LENGTH) {
			truncated = sr['lines'].length - TRUNCATE_LENGTH;
			lines = sr['lines'].slice(0, TRUNCATE_LENGTH);
		}
		else {
			lines = sr['lines'];
		}

		return {
			id: sr['id'],
			href: '#/quote_id/' + sr['id'],
			quoted: sr['quoted'].toLocaleString(),
			server: sr['server'],
			channel: sr['channel'],
			truncated: truncated,
			lines: lines.map(function (line) {
				return {
					content: line['content'],
					author: line['author'],
					timestamp: line['timestamp'].toLocaleString(),
					edited: line['edited'],
					style: {
						color: line['authorcolor'],
					},
					attachments: line['attachments'] || [],
				};
			}),
		};
	});

	search_results_vue.search_results = result_output;
	var dates = result_documents.map(function(sr) {
		return sr['quoted'];
	});
	search_results_vue.timeinterval_end = new Date(Math.max.apply(null,dates));
	search_results_vue.timeinterval_start = new Date(Math.min.apply(null,dates));
};

function fixedEncodeURIComponent(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, function(c) {
    return '%' + c.charCodeAt(0).toString(16);
  });
};
