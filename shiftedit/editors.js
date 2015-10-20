define(['app/tabs', 'exports', 'jquery','ace',"app/tabs", "app/util", "app/modes", 'jquery','app/lang','app/syntax_errors', "app/editor_toolbar", 'ace/split'], function (tabs, exports) {
var util = require('app/util');
var syntax_errors = require('app/syntax_errors');
var lang = require('app/lang').lang;
var modes = require('app/modes').modes;
var editor;
var editor_toolbar = require('app/editor_toolbar');

function onChange(e) {
    var tabs = require("app/tabs");
	tabs.setEdited(this, true);
}

function saveFolds() {
	var site = $(this).attr('data-site');
	var file = $(this).attr('data-file');

	if (site && file) {
		console.log('save state');

		var session = editor.getSession();

		var folds = session.getAllFolds().map(function (fold) {
			return {
				start: fold.start,
				end: fold.end,
				placeholder: fold.placeholder
			};
		});

		var sel = session.getSelection();

		var breakpoints = [];

		for( i=0; i<session.$breakpoints.length; i++ ){
			if( session.$breakpoints[i] ){
				breakpoints.push(i);
			}
		}

		var state = {
			scrolltop: session.getScrollTop(),
			scrollleft: session.getScrollLeft(),
			selection: sel.getRange(),
			folds: folds,
			breakpoints: breakpoints
		};

		$.post('/api/files?cmd=state&site='+site, {
			file: file,
			state: JSON.stringify(state)
		});
	}
}

function refresh(tab) {
	//editor.resize();

	window.splits[tab.attr('id')].forEach(
		function (editor) {
	        editor.setTheme("ace/theme/monokai");
		}
	);
}

function create(file, content, siteId, options) {
    if(!options){
        options = {};
    }

    //create tab
	tab = $(".ui-layout-center").tabs('add', file, '<div class="editor_toolbar"></div>\
	<div class="editor_status" data-currentError="0">\
    <button class="previous" type="button" disabled>\
    <i class="fa fa-arrow-left"></i></button> \
    <button class="next" type="button" disabled>\
    <i class="fa fa-arrow-right"></i></button> \
    <button class="fix" type="button" disabled>Fix</button> \
    <span class="status" style="font-size:11px;">' + lang.noSyntaxErrorsText + '</span>\
	</div>\
	\
	<div class="editor"></div>');

	tab.data(file, file);
	tab.attr('data-file', file);
	tab.attr('title', file);

	if(siteId) {
	    tab.data('site', siteId);
	    tab.attr('data-site', siteId);
	}

	if(options.mdate) {
	    tab.data('mdate', options.mdate);
	    tab.attr('data-mdate', options.mdate);
	}

    $(".ui-layout-center").trigger("tabsactivate", [{newTab:tab}]);

	//load ace

	//fixme panels can be in other tabarea
	var panel = $('.ui-layout-center').tabs('getPanelForTab', tab);

	// Splitting
	var container = panel.children('.editor')[0];
	editor = ace.edit(container);

	var Split = require("ace/split").Split;
	var theme = require("ace/theme/textmate");
	var split = new Split(container, theme, 1);
	editor = split.getEditor(0);
	editor.setTheme("ace/theme/monokai");
	editor.split = split;

	//split isn't properly implemented in Ace so we have to use globals :|
	if(!window.splits) window.splits = {};
	window.splits[tab.attr('id')] = split;

	var session = editor.getSession();

	//syntax bar handlers
	panel.find('.previous').click(jQuery.proxy(syntax_errors.previous, tab));

	panel.find('.next').click(jQuery.proxy(syntax_errors.next, tab));


	//set mode
	var ext = util.fileExtension(file);
	var mode = 'text';

	//check default file associations
	modes.forEach(function (item) {
		if (item[2].indexOf(ext) !== -1) {
			mode = item[0];
			return;
		}
	});

	editor.getSession().setMode("ace/mode/"+mode);
	editor.getSession().getDocument().setValue(content);

    //event listeners
	editor.getSession().doc.on('change', jQuery.proxy(onChange, tab));
	editor.getSession().on('changeFold', jQuery.proxy(saveFolds, tab));
	editor.getSession().on("changeAnnotation", jQuery.proxy(syntax_errors.update, tab));

	//shortcuts
	//save
	editor.commands.addCommand({
		name: "save",
		bindKey: {
			win: "Ctrl-S",
			mac: "Command-S",
			sender: "editor"
		},
		exec: jQuery.proxy(function (editor, args, request) {
			return tabs.save(this);
		}, tab)
	});
	editor.commands.addCommand({
		name: "saveAs",
		bindKey: {
			win: "Ctrl-Alt-S",
			mac: "Command-Alt-S",
			sender: "editor"
		},
		exec: jQuery.proxy(function (editor, args, request) {
			return tabs.saveAs(this);
		}, tab)
	});

	//move cursor to top
	var startLine = 0;

	editor.selection.setSelectionRange({
		start: {
			row: startLine,
			column: 0
		},
		end: {
			row: startLine,
			column: 0
		}
	});
	//console.log(options);
	if (options && options.state) {
	    restoreState(options.state);
	}

	//make toolbar
	editor_toolbar.create(tab);

	editor.focus();
}

function restoreState(state) {
	//restore folds and breakpoints
	if (state) {
		console.log('restore state');
		state = JSON.parse(state);

		var Range = require("ace/range").Range;
		var session = editor.getSession();
		//are those 3 lines set the values in per document base or are global for editor
		editor.selection.setSelectionRange(state.selection, false);
		session.setScrollTop(state.scrolltop);
		session.setScrollLeft(state.scrollleft);
		if (state.folds) {
			for (var i = 0, l = state.folds.length; i < l; i++) {
				var fold = state.folds[i];
				//console.log(fold);
				var range = Range.fromPoints(fold.start, fold.end);
				//console.log(range);
				session.addFold(fold.placeholder, range);
			}
		}

		// if newfile == 1 and there is text cached, restore it
		var node = session.getNode && session.getNode();
		if (node && parseInt(node.getAttribute("newfile") || 0, 10) === 1 && node.childNodes.length) {
			// the text is cached within a CDATA block as first childNode of the <file>
			if (session.getNode().childNodes[0] instanceof CDATASection) {
				session.setValue(doc.getNode().childNodes[0].nodeValue);
			}
		}

		//console.log(state.breakpoints);
		if(state.breakpoints){
			session.setBreakpoints(state.breakpoints);
		}
	}
}

function setMode(editor, mode) {
    editor.getSession().setMode("ace/mode/" + mode);
}

/*
return {
    create: create
};*/

exports.create = create;
exports.focus = focus;
exports.refresh = refresh;
exports.setMode = setMode;

});