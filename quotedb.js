var QUOTEDB_DOCUMENTS = null;
var QUOTEDB_MAP = null;
var idx = null;
var search_results_vue = null;

// grab the quotes json and set up lunr
$.getJSON('quotes.json', gotquotes);

// set up pathjs
$(document).ready(function() {
	Path.root('#/default');
	Path.listen();
});

// set up vue
$(document).ready(function() {
	search_results_vue = new Vue({
		el: '#search_results',
		data: {
			search_results: [],
		}
	});
	// 'refresh', basically, now that the vue thing is ready
	Path.dispatch(window.location.hash);
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

// does searches.
Path.map('#/search/:query').to(function() {
	query = decodeURIComponent(this.params['query']);
	console.log("searching: " + query);
	display_from_query(query);
});

// directly link to a quote
Path.map('#/quote_id/:quote_id').to(function() {
	console.log("going to quote: " + this.params['quote_id']);
	id = Number(this.params['query']);
	display_from_id(id);
});

// landing page is thing, show all quote
Path.map('#/default').to(function() {
	console.log("default");
	display_all();
});

// executed when we finish getting the quotes json: reindex and 'refresh'
function gotquotes(json){
	reindex(json);
	Path.dispatch(window.location.hash);
};

// create the quotes database and lunr index from the given object, which should
// be an array of quote objects
function reindex(json) {
	QUOTEDB_DOCUMENTS = json;

	QUOTEDB_MAP = {};
	QUOTEDB_DOCUMENTS.forEach(function (doc) {
		QUOTEDB_MAP[doc['id']] = doc;
	});

	idx = lunr(function () {
		this.ref('id');
		this.field('lines');
		this.field('authors');

		QUOTEDB_DOCUMENTS.forEach(function (doc) {
			this.add({
				'id': doc['id'],
				'lines': doc['lines'].map(function (line) { return line['content'] }),
				'authors': doc['lines'].map(function (line) { return line['author'] }),
			});
		}, this);
	});
};

// if we have a query in the box, go to do a query. if the box is empty, go to
// show all results.
function search_button_onclick() {
	var query = $('#search_query_box').val();
	if (query) {
		window.location.hash = '#/search/' + fixedEncodeURIComponent(query);
	}
	else {
		window.location.hash = '#/default';
	};
};

// update vue to display a single quote identified by its ID
function display_from_id(id) {
	if (id in QUOTEDB_MAP) {
		var result_documents = [QUOTEDB_MAP[id]];
		update_search_results_vue(result_documents);
	};
};

// update vue to display 'all' quotes, which ius really the ten most recently
// uploaded
function display_all() {
	var result_documents = QUOTEDB_DOCUMENTS;
	result_documents.sort(function(a, b) {
		// put largest (most recent) timestamps first
		return a['quoted'] > b['quoted'];
	});
	result_documents = result_documents.slice(0, 10);
	update_search_results_vue(result_documents);
};

// update vue to display results that match the given lunr query
function display_from_query(query) {
	if (!idx) { return; };
	var result_documents = search_quote_db(query);
	update_search_results_vue(result_documents);
};

// do a search against lunr and return the set of documents that results
function search_quote_db(query) {
	results = idx.search(query);
	// sort from largest score to smallest score to sort relevant results first
	results.sort(function(a, b) {
		return a['score'] < b['score'];
	});
	result_documents = results.map(function(sr) {
		return QUOTEDB_MAP[sr.ref];
	});

	return result_documents;
};

// update vue with the data for the current set of documents
function update_search_results_vue(result_documents) {
	if (!search_results_vue) { return; };

	result_output = result_documents.map(function(sr) {
		return {
			'id': sr['id'],
			'href': '#/quote_id/' + sr['id'],
			'quoted': (new Date(sr['quoted'])).toLocaleString(),
			'lines': sr['lines'].map(function (line) {
				return {
					'content': line['content'],
					'author': line['author'],
					'timestamp': (new Date(line['timestamp'])).toLocaleString(),
					'edited': line['edited'],
				};
			}),
		};
	});
	search_results_vue.search_results = result_output;
};

function fixedEncodeURIComponent(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, function(c) {
    return '%' + c.charCodeAt(0).toString(16);
  });
};

