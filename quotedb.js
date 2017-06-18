var QUOTEDB_DOCUMENTS = null;
var QUOTEDB_MAP = null;
var idx = null;

$.getJSON('quotes.json', gotquotes);

function gotquotes(json){
	reindex(json)
	search_button_onclick();
}

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
}



var search_results_vue = null;
$(document).ready(function() {
	search_results_vue = new Vue({
		el: '#search_results',
		data: {
			search_results: [],
		}
	});

	$('#search_query_box').keypress(function(e) {
        if (e.keyCode == 13) {
			$('#search_query_submit_button').click();
			return false;
		};
	});

	search_button_onclick();
});

function search_button_onclick() {
	if (!idx) { return; };
	if (!search_results_vue) { return; };

	query = $('#search_query_box').val();
	var result_documents;
	if (!query) {
		result_documents = QUOTEDB_DOCUMENTS;
		result_documents.sort(function(a, b) {
			// put largest (most recent) timestamps first
			return a['quoted'] > b['quoted'];
		});
		result_documents = result_documents.slice(0, 10);
	}
	else {
		result_documents = search_quote_db(query);
	}
	update_search_results_vue(result_documents);
}

function search_quote_db(query) {
	results = idx.search(query);
	// sort from largeest score to smallest score to put most relevant results
	// first.
	results.sort(function(a, b) {
		return a['score'] < b['score'];
	});
	result_documents = results.map(function(sr) {
		return QUOTEDB_MAP[sr.ref]
	});


	return result_documents
};

function update_search_results_vue(result_documents) {
	result_output = result_documents.map(function(sr) {
		return {
			'id': sr['id'],
			'quoted': (new Date(sr['quoted'])).toLocaleString(),
			'lines': sr['lines'].map(function (line) {
				return {
					'content': line['content'],
					'author': line['author'],
					'timestamp': (new Date(line['timestamp'])).toLocaleString(),
					'edited': line['edited'],
				}
			}),
		}
	});
	search_results_vue.search_results = result_output;
}
