define(["jquery-ui","app/prompt", "app/tree", "app/storage", "ui.combobox", "app/util", "app/ssl", "app/loading"], function () {
var prompt = require('app/prompt');
var tree = require('app/tree');
var storage = require('app/storage');
var lang = require('app/lang').lang;
var util = require('app/util');
var ssl = require('app/ssl');
var loading = require('app/loading');

var sites = [];
var currentSite = storage.get('currentSite');

var combobox;

function enableMenuItems(site) {
    var items = ['editsite', 'duplicate', 'deletesite', 'export', 'share', 'download'];

    if(site.db_phpmyadmin)
        items.push('phpmyadmin');

    if(site.server_type==='Hosted')
        items.push('reboot');

    items.forEach(function(item){
        $('#'+item).removeClass('ui-state-disabled');
    });
}

function disableMenuItems() {
    var items = ['editsite', 'duplicate', 'deletesite', 'export', 'share', 'download', 'phpmyadmin', 'ssh', 'reboot'];

    items.forEach(function(item){
        $('#'+item).removeClass('ui-state-disabled');
    });
}

function init() {
    combobox = $( "#sites" ).combobox({
        select: function (event, ui) {
            //connect to site
            open(ui.item.value);
        },
        change: function (event, ui) {
            //connect to site
            open(ui.item.value);
        },
        create: function( event, ui ) {
            //load();
        }
    });

    $( "#refresh_site" ).button({
        icons: {
           primary: "ui-icon-refresh"
        },
        text: false
    })
    .click(function() {
        tree.refresh();
    });

    //button menu
    var items = [{
        id: 'newsite',
        text: 'New site..',
        handler: create,
        disabled: false
    }, {
        id: 'editsite',
        text: 'Edit site..',
        handler: edit,
        disabled: true
    }, {
        id: 'duplicate',
        text: 'Duplicate..',
        handler: duplicate,
        disabled: true
    }, {
        id: 'deletesite',
        text: 'Delete site',
        handler: function(undef, e, confirmed) {
            if(!confirmed) {
                var me = this;
                prompt.confirm({
                    title: 'Delete site',
                    msg: 'Are you sure?',
                    fn: function(value) {
                       switch(value) {
                            case 'yes':
                                $(me).trigger('click', [true]);
                                return;
                            default:
                                return false;
                       }
                    }
                });
                return;
            }

            var ajax;
        	if (!loading.start('Deleting site '+site.name, function(){
        		console.log('abort deleting site');
        		ajax.abort();
        	})) {
        		return;
        	}

            ajax = $.ajax({
                url: '/api/sites?cmd=delete&site='+currentSite,
        	    method: 'GET',
        	    dataType: 'json',
            })
            .then(function (data) {
                loading.stop();
                //console.log(data);

                if(data.success){
                    //remove this site from any active tabs
                    $("li[data-site='"+currentSite+"']").attr('data-site', '');

                    //disable file tree
                    $('#tree').hide();

                    //disable site options
                    disableMenuItems();

                    currentSite = 0;

                    //refresh combo
                    $( "#sites" ).combobox('val');
                    load();
                }else{
                    prompt.alert({title:'Error', msg:data.error});
                }
            }).fail(function() {
                loading.stop();
        		prompt.alert({title:lang.failedText, msg:'Error deleting site'});
            });
        },
        disabled: true
    }, '-', {
        id: 'import',
        text: 'Import..',
        handler: function() {
            //import site dialog
            $( "body" ).append('<div id="dialog-message" title="Import site">\
              <form>\
                <fieldset>\
                    Import a Dreamweaver or Filezilla xml file.\
                    <input type="file" name="file" id="importSite" class="text ui-widget-content ui-corner-all">\
                </fieldset>\
              </form>\
            </div>');

            function doImport(content){
                $( "#dialog-message" ).dialog( "close" );
                $( "#dialog-message" ).remove();

                var ajax;
            	if (!loading.start('Importing site '+site.name, function(){
            		console.log('abort importing site');
            		ajax.abort();
            	})) {
            		return;
            	}

                ajax = $.ajax({
                    url: '/api/sites?cmd=import',
            	    method: 'POST',
            	    dataType: 'json',
            	    data: {
            	        content: content
            	    }
                })
                .then(function (data) {
                    loading.stop();

                    if(data.success){
						prompt.alert({title: 'Success', msg: data.imported+' site(s) imported.'});
						currentSite = data.site;
						load();
                    }else{
                        prompt.alert({title:'Error', msg:data.error});
                    }
                }).fail(function() {
                    loading.stop();
            		prompt.alert({title:lang.failedText, msg:'Error importing site'});
                });
            }

            $('#importSite').change(function(e){
                var files = e.target.files; // FileList object

        		if (files.length === 0) {
        			return;
        		}

        		var file = files[0];
    			var reader = new FileReader();
    			reader.onloadend = function (file) {
    				return function () {
    					doImport(reader.result);
    				};
    			}(file);

                reader.readAsText(file);
            });

            //open dialog
            var dialog = $( "#dialog-message" ).dialog({
                modal: true,
                width: 400,
                height: 300
            });
        },
        disabled: false
    }, {
        id: 'export',
        text: 'Export',
        handler: function() {
            var ajax;
        	if (!loading.start('Exporting site '+site.name, function(){
        		console.log('abort exporting site');
        		ajax.abort();
        	})) {
        		return;
        	}

            ajax = $.ajax({
                url: '/api/sites?cmd=export&site='+currentSite,
        	    method: 'GET',
        	    dataType: 'json',
            })
            .then(function (data) {
                loading.stop();

                if(data.success){
                    var link = $('<a href="data:text/xml;base64,'+btoa(data.content)+'" download="'+data.file+'"></a>').appendTo('body');
                    link.get(0).click();
                    link.remove();
                }else{
                    prompt.alert({title:'Error', msg:data.error});
                }
            }).fail(function() {
                loading.stop();
        		prompt.alert({title:lang.failedText, msg:'Error exporting site'});
            });
        },
        disabled: true
    }, {
        id: 'share',
        text: 'Share site',
        handler: function() {},
        disabled: true
    }, {
        id: 'download',
        text: 'Download revisions',
        handler: function() {
	        window.open('_ajax/download_revisions.php?site='+currentSite);
        },
        disabled: true
    }, '-', {
        id: 'phpmyadmin',
        text: 'PhpMyAdmin',
        handler: function() {
    		var settings = getSettings(currentSite);
    		var password = settings.db_password;

            /*
    		if (prefs.useMasterPassword) {
    			password = Aes.Ctr.decrypt(settings.db_password, localStorage.masterPassword, 256);
    		}
    		*/

    		// create hidden form
    		var form = $('<form id="pma_form" method="post" target="_blank" action="'+settings.db_phpmyadmin+'">\
    		<input type="hidden" name="pma_username" value="'+settings.db_username+'">\
    		<input type="hidden" name="pma_password" value="'+password+'">\
    		</form>').appendTo('body')
    		.on('submit', function(){
    		    $(this).remove();
    		})
    		.submit();
        },
        disabled: true
    }, '-', {
        id: 'ssh',
        text: 'SSH Terminal',
        handler: function() {},
        disabled: true
    }, {
        id: 'reboot',
        text: 'Reboot',
        handler: function() {
            var ajax;
        	if (!loading.start('Rebooting site '+site.name, function(){
        		console.log('abort reboot');
        		ajax.abort();
        	})) {
        		return;
        	}

            ajax = $.ajax({
                url: '/api/sites?cmd=reboot&site='+currentSite,
        	    method: 'GET',
        	    dataType: 'json',
            })
            .then(function (data) {
                loading.stop();

                //refresh tree?
            }).fail(function() {
                loading.stop();
        		prompt.alert({title:lang.failedText, msg:'Error rebooting'});
            });
        },
        disabled: true
    }];

    var el = $("#siteMenu");
    var context;
    items.forEach(function(item) {
        if(item==='-') {
            el.append('<li>-</li>');
        } else {
            var itemEl = $('<li id="'+item.id+'">\
                <a href="#">'+item.text+'</a>\
            </li>').appendTo(el);

            if(item.disabled) {
                itemEl.addClass('ui-state-disabled');
            }

            if(item.handler) {
                itemEl.click(jQuery.proxy(item.handler, undefined, context));
            }
        }
    });

    var menu = $("#siteMenu").menu().hide();

    $("#siteNenuBtn").button({
        icons: {
            primary: "ui-icon-gear"
        },
        text: false
    })
    .click(function() {
        // Make use of the general purpose show and position operations
        // open and place the menu where we want.
        menu.show().position({
              my: "left top",
              at: "left bottom",
              of: this
        });

        // Register a click outside the menu to close it
        $( document ).on( "click", function() {
              menu.hide();
        });

        // Make sure to return false here or the click registration
        // above gets invoked.
        return false;
    });
}

function open(siteId, password) {
    currentSite = null;

    var site = getSettings(siteId);
    currentSite = siteId;

    var ajax;
	if (!loading.start('Connecting to site '+site.name, function(){
		console.log('abort opening site');
		ajax.abort();
		opening = {};
	})) {
		console.log('in queue');
		return;
	}

    ajax = $.ajax({
        url: '/api/sites?site='+siteId,
	    method: 'POST',
	    dataType: 'json',
	    data: {
	        password: password,
	        save_password: 1
	    }
    })
    .then(function (data) {
        loading.stop();
        //console.log(data);

        if(data.success){
            storage.set('currentSite', currentSite);

            //load file tree
            var options = getAjaxOptions('/api/files?site='+siteId);
            tree.setAjaxOptions(options);

            //enable site options
            enableMenuItems(site);

            //show tree
            $('#tree').show();
        }else{
            if (data.require_password) {
    			loading.stop();

        		password = site.ftp_pass;

        		/*
        		if (prefs.useMasterPassword) {
        			if (password) {
        				password = (Aes.Ctr.decrypt(password, storage.get('masterPassword'), 256));
        			}
        		}
        		*/

    			prompt.prompt({
    			    title: 'Require server password for '+site.name,
    			    msg: lang.passwordText,
    			    value: password,
    			    password: true,
    			    fn: function(btn, password) {
    			        switch(btn) {
    			            case 'ok':
                                /*
    							var prefs = prefs.get_prefs();
    							if (prefs.useMasterPassword) {
    								if (params.password) {
    									params.password = Aes.Ctr.encrypt(params.password, storage.get('masterPassword'), 256);
    								}
    							}
    							*/

    							open(siteId, password);
			                break;
    			        }
    			    }
    			});
            }else{
                prompt.alert({title:'Error', msg:data.error});
            }
        }
    }).fail(function() {
        loading.stop();
		prompt.alert({title:lang.failedText, msg:'Error opening site'});
    });

    return ajax;
}

function load() {
    return $.getJSON('/api/sites')
        .then(function (data) {
            sites = data.sites;

            $( "#sites" ).children('option').remove();

            $.each(sites, function( index, site ) {
                $( "#sites" ).append( '<option value="'+site.id+'">'+site.name+'</option>' );
            });

            if(currentSite){
                $( "#sites" ).val(currentSite).change();
            }

            return sites;
        });
}

function create() {
    edit(true);
}

function duplicate() {
    edit(false, true);
}

function updateCategory() {
    var category = $('input[name=server_type]').val();

    fields = [
        'hosted_container',
        'cloud_container',
        'host_container',
        'proxyfield',
        'domainContainer',
        'portContainer',
        'timeoutContainer',
        'authentication_container',
        'ftp_user',
        'pass_container',
        'ssh_key_container',
        'dir_container',
        'web_url',
        'turbo_mode_container',
        'git_url',
        's3_public',
        's3info',
        'gdrivelimited',
        'testSiteButton'
    ];

    categories = {
        'FTP': [
            'host_container',
            'portContainer',
            'timeoutContainer',
            'ftp_user',
            'pass_container',
            'dir_container',
            'web_url',
            'turbo_mode_container',
            'testSiteButton'
        ],
        'SFTP': [
            'host_container',
            'portContainer',
            'timeoutContainer',
            'authentication_container',
            'ftp_user',
            'pass_container',
            'dir_container',
            'web_url',
            'turbo_mode_container',
            'testSiteButton'
        ],
        'Cloud': [
            'cloud_container',
        ],
        'AmazonS3': [
            'cloud_container',
            's3_public',
            's3info',
            'ftp_user',
            'pass_container',
            'dir_container',
            'web_url',
            'testSiteButton'
        ],
        'Dropbox': [
            'cloud_container',
            'dir_container',
            'testSiteButton'
        ],
        'GDrive': [
            'cloud_container',
            'gdrivelimited',
            'dir_container',
            'testSiteButton'
        ],
        'GDriveLimited': [
            'cloud_container',
            'gdrivelimited',
            'dir_container',
            'testSiteButton'
        ],
        'Hosted': [
            'git_url',
            'hosted_container'
        ],
        'Proxy': [
            'proxyfield',
            'host_container',
            'ftp_user',
            'pass_container',
            'dir_container',
            'web_url',
            'testSiteButton'
        ],
        'WebDAV': [
            'host_container',
            'ftp_user',
            'pass_container',
            'dir_container',
            'web_url',
            'testSiteButton'
        ]
    };

    fields.forEach(function(field){
        $('#'+field).hide();
    });

    if (categories[category]) {
        categories[category].forEach(function(field){
            $('#'+field).show();
        });
    }

    //domain placeholder
    var domain_placeholder = 'e.g. ftp.mydomain.com';
    if( category==='Proxy' ){
        domain_placeholder = 'e.g. www.mydomain.com/shiftedit-proxy.php';
    } else if( category==='SFTP' ){
        domain_placeholder = 'e.g. mydomain.com';
    } else if( category==='WebDAV' ){
        domain_placeholder = 'e.g. www.mydomain.com';
    }

    $('#domain').attr('placeholder', domain_placeholder);

    //username placeholder
    var username_placeholder = 'your username';
    if( category==='AmazonS3' ){
        username_placeholder = 'access key id';
    }

    $('#ftp_user').attr('placeholder', username_placeholder);

    //password placeholder
    var password_placeholder = 'leave blank to prompt for password';
    if( category==='AmazonS3' ){
        password_placeholder = 'secret access key';
    }

    $('#password').attr('placeholder', password_placeholder);
}

function edit(newSite, duplicate) {
	if (newSite && storage.get('premier') == 'false' && storage.get('edition') == 'Standard' && sites.length >= (1+1)) {
		return prompt.alert({title: 'Quota exceeded', msg:'Free edition is limited to 1 site. <a href="/premier" target="_blank">Go Premier</a>'});
	} else if (newSite && storage.get('premier') == 'false' && storage.get('edition') == 'Education' && sites.length >= (5+1)) {
		return prompt.alert({title: 'Quota exceeded', msg:'Education edition is limited to 5 sites. <a href="/premier" target="_blank">Go Premier</a>'});
	}

	//create dialog BEWARE UGLY LONG STRING!
    $( "body" ).append('<div id="dialog-site" title="Site settings">\
      <form id="siteSettings" autocomplete="off">\
        <input type="hidden" name="server_type" value="">\
        <input type="hidden" name="id" value="">\
        <!-- fake fields are a workaround for chrome autofill -->\
        <input style="display:none" type="text" name="fakeusernameremembered"/>\
        <input style="display:none" type="password" name="fakepasswordremembered"/>\
        <div id="siteTabs">\
        	<ul>\
        	    <li><a href="#tabs-site">Site</a></li>\
        	    <li><a href="#tabs-database">Database</a></li>\
        	</ul>\
            <div>\
                <div id="tabs-site">\
                    <p>\
                        <label for="name">Name:</label>\
                        <input type="text" name="name" value="" class="text ui-widget-content ui-corner-all" required>\
                    </p>\
                    <p>\
                        <label for="name">Server type:</label>\
                        <span id="serverTypeRadio">\
                            <input type="radio" name="serverTypeItem" value="FTP" id="radio1" checked><label for="radio1">FTP</label>\
                            <input type="radio" name="serverTypeItem" value="SFTP" id="radio2"><label for="radio2">SFTP</label>\
                            <input type="radio" name="serverTypeItem" value="Cloud" id="radio3"><label for="radio3">Cloud Services</label>\
                            <input type="radio" name="serverTypeItem" value="Hosted" id="radio4"><label for="radio4">Hosted</label>\
                            <input type="radio" name="serverTypeItem" value="Other" id="other"><label for="other" id="otherLabel">Other</label>\
                            <ul id="otherMenu">\
                                <li><a href="#">Proxy</a></li>\
                                <li><a href="#">WebDAV</a></li>\
                            </ul>\
                        </span>\
                    </p>\
                    \
                    <div id="hosted_container">\
                        <p>\
                            <label for="name">Stack:</label>\
                            <span id="stackRadio">\
                                <input type="radio" name="stack" value="php" id="stackRadio1">\
                                <label for="stackRadio1" checled>\
                                    <img src="/images/logos/php.svg" height="32" width="32"><br>\
                                    PHP\
                                </label>\
                                <input type="radio" name="stack" value="nodejs" id="stackRadio2">\
                                <label for="stackRadio2">\
                                    <img src="/images/logos/nodejs.svg" height="32" width="32"><br>\
                                    Node.js\
                                </label>\
                            </span>\
                        </p>\
                        <p>\
                            <label for="name">Git URL:</label>\
                            <input type="text" name="git_url" value="" class="text ui-widget-content ui-corner-all" required>\
                        </p>\
                    </div>\
                    \
                    <div id="cloud_container">\
                        <p>\
                            <label for="name">Cloud services:</label>\
                            <span id="cloudRadio">\
                                <input type="radio" name="cloud" value="Dropbox" id="cloudRadio1">\
                                <label for="cloudRadio1">\
                                    <img src="/images/logos/dropbox.svg" height="32" width="32"><br>\
                                    Dropbox\
                                </label>\
                                <input type="radio" name="cloud" value="GDrive" id="cloudRadio2">\
                                <label for="cloudRadio2">\
                                    <img src="/images/logos/googledrive.svg" height="32" width="32"><br>\
                                    Google Drive\
                                </label>\
                                <input type="radio" name="cloud" value="AmazonS3" id="cloudRadio3">\
                                <label for="cloudRadio3">\
                                    <img src="/images/logos/amazons3.svg" height="32" width="32"><br>\
                                    Amazon S3\
                                </label>\
                            </span>\
                        </p>\
                    </div>\
                    \
                    <label id="proxyfield">Use a PHP proxy file to handle connections. You will need to configure and upload the \
                    <a href="https://raw.githubusercontent.com/adamjimenez/shiftedit-ajax/master/shiftedit-proxy.php" target="_blank">proxy file</a>\
                    to your webspace.</label>\
                    \
                    <div id="host_container">\
                        <p>\
                            <label for="name">Host:</label>\
                            <input type="text" id="domain" name="domain" value="" class="text ui-widget-content ui-corner-all" required>\
                            <span id="portContainer">\
                                <label for="name">Port:</label>\
                                <input type="number" name="port" value="" class="text ui-widget-content ui-corner-all">\
                            </span>\
                            <span id="timeoutContainer">\
                                <label for="name">Timeout:</label>\
                                <input type="number" name="timeout" value="" class="text ui-widget-content ui-corner-all" required>\
                            </span>\
                        </p>\
                    </div>\
                    <p id="authentication_container">\
                        <label for="name">Authentication:</label>\
                        <span id="authenticationRadio">\
                            <input type="radio" name="logon_type" value="" id="authRadio1" checked><label for="authRadio1">Password</label>\
                            <input type="radio" name="logon_type" value="key" id="authRadio2"><label for="authRadio2">Public Key</label>\
                        </span>\
                    </p>\
                    <p id="ftp_user">\
                        <label for="name">Username:</label>\
                        <input type="text" id="ftp_user" name="ftp_user" value="" class="text ui-widget-content ui-corner-all" required>\
                    </p>\
                    <p id="pass_container">\
                        <label for="name">Password:</label>\
                        <input type="password" id="password" name="ftp_pass" value="" class="text ui-widget-content ui-corner-all" required>\
                        <button type="button" id="showPassword">Show</button>\
                    </p>\
                    <p id="ssh_key_container">\
                        <label for="name">Your SSH key:</label>\
                        <textarea id="sshKey" readonly>'+storage.get('public_key')+'</textarea>\
                        <label>Save the SSH key in your: ~/.ssh/authorized_keys</label>\
                    </p>\
                    <p id="dir_container">\
                        <label for="name">Path:</label>\
                        <input type="text" name="dir" value="" class="text ui-widget-content ui-corner-all">\
                        <button type="button">Choose</button>\
                    </p>\
                    <p id="web_url">\
                        <label for="name">Website URL:</label>\
                        <input type="text" name="web_url" value="" class="text ui-widget-content ui-corner-all">\
                    </p>\
                    <p id="turbo_mode_container">\
                        <label for="name">Turbo mode:</label>\
                        <input type="checkbox" name="turbo" value="1" class="text ui-widget-content ui-corner-all" >\
                        Uploads a PHP proxy file for faster connections.\
                    </p>\
                    <p id="gdrivelimited">\
                        <label for="name">Limited access:</label>\
                        <input type="checkbox" name="gdrivelimited" value="1" class="text ui-widget-content ui-corner-all" >\
                        Limit access to only files created in ShiftEdit.\
                    </p>\
                    <p id="s3_public">\
                        <label for="name">Save files with public access:</label>\
                        <input type="checkbox" name="s3_public" value="1" class="text ui-widget-content ui-corner-all" >\
                    </p>\
                </div>\
                <div id="tabs-database">\
                    <p>\
                        <label for="name">PhpMyAdmin Url:</label>\
                        <input type="text" name="db_phpmyadmin" value="" class="text ui-widget-content ui-corner-all">\
                    </p>\
                    <p>\
                        <label for="name">Username:</label>\
                        <input type="text" name="db_phpmyadmin" value="" class="text ui-widget-content ui-corner-all">\
                    </p>\
                    <p>\
                        <label for="name">Password:</label>\
                        <input type="password" name="db_password" value="" class="text ui-widget-content ui-corner-all">\
                        <button type="button" id="showDbPassword">Show</button>\
                    </p>\
                </div>\
            </div>\
        </div>\
        <input type="submit" tabindex="-1" style="position:absolute; top:-1000px">\
      </form>\
    </div>');

    //set values
    var defaults = {
        server_type: 'FTP',
        timeout: 10
    };
    var settings = newSite ? defaults : getSettings();

    for(var i in settings) {
		if (settings.hasOwnProperty(i)) {
		    var field = $('[name='+i+']');
		    switch(field.attr('type')){
		        case 'checkbox':
		            if (settings[i]==1)
		                field.prop('checked', true);
	            break;
	            default:
                    field.val(settings[i]);
                break;
		    }
		}
    }

    //select ssh key
    $('#sshKey').click(function(){
        $(this).select();
    });

    //"Other" split button
    $('#otherMenu').menu().hide();
    $('#otherMenu a').click(function() {
        $('#otherLabel').children('span').text($(this).text());
        $('#other').val($(this).text());
        $('#otherLabel').trigger('click');
    });
    $('#otherLabel').click(function() {
        var menu = $('#otherMenu').show().position({
              my: "left top",
              at: "left bottom",
              of: this
        });
        $( document ).one( "click", function() {
            menu.hide();
        });
        return false;
    });

    //tabs and buttons
    $( "#siteTabs" ).tabs();
    $( "#serverTypeRadio" ).buttonset();
    $( "#stackRadio" ).buttonset();
    $( "#cloudRadio" ).buttonset();
    $( "#authenticationRadio" ).buttonset();

    $( "#showPassword,#showDbPassword" ).click(function(){
        var input = ($( this ).prev());
        if(input.attr('type')==='text') {
            input.attr('type', 'password');
        }else{
            input.attr('type', 'text');
        }
    });

    //toggle fields
    $('#cloud_container label, #serverTypeRadio label').click(function() {
        var category = $(this).prev().prop('checked', true).val(); //make sure radio is checked
        $('input[name=server_type]').val(category);
        updateCategory();
    });

    //trimage
    $('#siteSettings input[type=text]').blur(function(){
        $(this).val($(this).val().trim());
    });

    updateCategory();

    //open dialog
    var dialog = $( "#dialog-site" ).dialog({
        modal: true,
        buttons: {
            Save: function() {
                var ajax;
            	if (!loading.start('Saving site '+site.name, function(){
            		console.log('abort saving site');
            		ajax.abort();
            	})) {
            		return;
            	}

                ajax = $.ajax({
                    url: '/api/sites?cmd=save&site='+$('#siteSettings [name=id]').val(),
            	    method: 'POST',
            	    dataType: 'json',
            	    data: $('#siteSettings').serialize()
                })
                .then(function (data) {
                    loading.stop();

                    if(data.success){
						/*
						//set gdrive folder to public
						if(
						    (
						        server_type === 'GDrive' ||
						        server_type === 'GDriveLimited'
						    ) &&
						    dir_id
						){
						    console.log('set permissions');
						    shiftedit.app.gdrive.set_public(dir_id, true);
						}
						*/

						currentSite = data.site;
						load();

						$( "#dialog-site" ).dialog( "close" );
                        $( "#dialog-site" ).remove();
                    }else{
                        prompt.alert({title:'Error', msg:data.error});
                    }
                }).fail(function() {
                    loading.stop();
            		prompt.alert({title:lang.failedText, msg:'Error saving site'});
                });
            }
        },
        width: 520,
        minWidth: 520,
        minHeight: 300
    });
}

function active() {
    return currentSite;
}

function getSettings(val) {
    if(!val) {
        val = currentSite;
    }

    var key = isNaN(val) ? 'name' : 'id';

    site = false;
    sites.forEach(function(entry) {
        if(entry[key]==val){
            site = entry;
            return;
        }
    });

    return site;
}

function getAjaxOptions(ajaxUrl) {
    var settings = getSettings();
    var params = {};

    if(settings.server_type == 'AJAX' || settings.turbo == 1) {
        if(settings.turbo){
        	if( settings.web_url ){
        		ajaxUrl = settings.web_url+'shiftedit-proxy.php?ModPagespeed=off';
        	}else{
        		prompt.alert({title:lang.errorText, msg:'Missing web URL'});
        	}

    		//var prefs = get_prefs();

    		//fixme prompt for master password
    		//var pass = prefs.useMasterPassword ? Aes.Ctr.decrypt(settings.ftp_pass, storage.get('masterPassword'), 256) : settings.ftp_pass;

    		var pass = settings.ftp_pass;

    		params = {
    			user: settings.ftp_user,
    			pass: util.sha1(pass)
    		};
        }else{
        	ajaxUrl = settings.domain;

        	if( settings.encryption == '1' ){
        		ajaxUrl = 'https://'+ajaxUrl;
        	}else{
        		ajaxUrl = 'http://'+ajaxUrl;
        	}
        }

        if(util.startsWith(ajaxUrl, 'http://') && ssl.check_blocked()){
            prompt.alert({title:'Proxy Blocked', msg:'Click Shield icon in address bar, then "Load Unsafe Script"'});
        }
    }

    return {
        site: settings.id,
        url: ajaxUrl,
        params: params
    };
}

return {
    init: init,
    load: load,
    active: active,
    getSettings: getSettings,
    getAjaxOptions: getAjaxOptions
};

});