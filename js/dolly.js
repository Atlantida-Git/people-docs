// dolly.js 2 library

// requires jQuery
// requires dolly.css

/*
$(function() {
$(document).keydown(function(event) {
    console.log(event);
    if (event.ctrlKey && event.which == 48) {
       $("#result").val('<borrar>'); Ø

       event.preventDefault();
    } else if ($("#result").val() == '<borrar>')
    		$("#result").val('');
});
});
*/
(function($) {
	// custom AJAX call with reduced timeout
	$.nimbus = {
		getJSON: function(url, data, success) {
			return $.ajax({
				dataType: 'json',
				timeout: 20000,
				url: url,
				data: typeof data == 'function' ? undefined : data,
				success: typeof data == 'function' ? data : success
			});
		}
	};
	// custom simple cookie support
	$.cookies = {
		create: function(name, value, days, path) {
			var expires;
			if (days) {
				var date = new Date();
				date.setTime(date.getTime() + (days*24*60*60*1000));
				expires = '; expires=' + date.toGMTString();
			} else
				expires = '';
			document.cookie = name + '=' + value + expires + (path ? '; path=' + path : '');
		},
		read: function(name) {
			var nameEQ = name + '=';
			var ca = document.cookie.split(';');
			for (var i = 0; i < ca.length; i++) {
				var c = ca[i];
				while (c.charAt(0) == ' ') c = c.substring(1, c.length);
				if (c.indexOf(nameEQ) == 0)
					return c.substring(nameEQ.length, c.length);
			}
			return null;
		},
		erase: function(name) {
			this.create(name, '', -1);
		},
		append: function(name, value, token) {
			var old = this.read(name), current;
			current = old ? old + token + value : value;
			this.erase(name);
			this.create(name, current);
		},
		replace: function(name, value, days, path) {
			this.erase(name);
			this.create(name, value, days, path);
		}
	};
	$.fn.exists = function () {
 	   return this.length !== 0;
	};
    $.fn.closestDown = function(filter) {
        var $found = $(),
            $currentSet = this; // Current place
        while ($currentSet.length) {
            $found = $currentSet.filter(filter);
            if ($found.length) break;  // At least one match: break loop
            // Get all children of the current set
            $currentSet = $currentSet.children();
        }
        return $found.first(); // Return first match of the collection
    };
	$.scrollbarWidth = function() {
		var parent, child, width;
		parent = $('<div style="width:50px;height:50px;overflow:auto"><div></div></div>').appendTo('body');
		child = parent.children();
		width = child.innerWidth() - child.height(99).innerWidth();
		//width = parent.width() - child.innerWidth();
		parent.remove();
		return width;
	};
    $.debounce = function(func, time){
        var time = time || 100; // 100 by default if no param
        var timer;
        return function(event) {
            if (timer) clearTimeout(timer);
            timer = setTimeout(func, time, event);
        };
    };
})(jQuery);

// dolly library
var dolly = {
	config: new (function() {
		var cfg = {
			baseUrl: '',
			dialogDelay: 400,
			onFailedFetch: function(jqxhr) {},
			onFailedVerify: function(response) {}
		};
		this.set = function(prop, value) {
			cfg[prop] = value;
		};
		this.get = function(prop) {
			return cfg[prop];
		};
		this.resolve = function(url) {
			return url && url.charAt(0) == '/' ? url : cfg.baseUrl + url;
		};
	})(),

	Module: function(name, source, target) {
		var This = this;
		var data = undefined;
		var parameters = new dolly.Parameters();
		var valid = false;
		var events = {};
		var interfaces = {};
		var private = {};
		var mode = 'insert';
		
		var verifier = null;
		var parser = null;
		var encoder = null;
		var intervalId = null;
		var intervalCount = 0;

		var verify = function(info) {
			return verifier ? !!verifier(info) : true;
		}
		var parse = function(info) {
			return parser ? parser(info) : info;
		};
		
		var raise = function(evname, params) {
			if (events[evname]) 
				events[evname].forEach(function(handler) {handler(This, params);});
		};
		
		this.name = function() {return name || 'untitled';};

		this.mode = function(m) {
			if (m === undefined)
				return mode;
			else {
				switch (m) {
					case 'insert': case 'update': mode = m; break;
				}
				return This;
			}
		};

		this.get = function(key) {
			if (key === undefined)
				return data;
			else
				return valid ? data[key] : undefined;
		};

		this.set = function(key, value) {
			if (typeof key == 'string') {
				console.log('module ' + This.name() + ' set: setting [key, value] =', key, value);
				data[key] = value;
			} else if ($.isPlainObject(key)) {
				console.log('module ' + This.name() + ' set: setting object =', key);
				This.extend(key);
			}
			valid = true;
			return This;
		};

		this.replace = function(newdata) {
			data = newdata;
			This.bind();
			raise('endReplace');
			return This;
		};

		this.private = function(key, value) {
			if (value === undefined)
				return private[key];
			else {
				private[key] = value;
				return This;
			}
		};

		this.append = function(newdata, parsed) {
			console.log('module ' + This.name() + ' append: appending [data, newdata] =', data, newdata);
			var parsedData = parsed ? newdata : parse(newdata);
			if ($.isArray(data) && $.isArray(parsedData)) {
				for (var i = 0; i < parsedData.length; i++) {
					data.push(parsedData[i]);
					This.bind(parsedData[i]);
				}
				raise('endAppend');
			}
			console.log('module ' + This.name() + ' append: appended =', data);
			return This;
		};
		
		this.extend = function(newdata) {
			console.log('module ' + This.name() + ' extend: extending [data, newdata] =', data, newdata);
			if (data === undefined)
				data = newdata;
			else if ($.isArray(data) && $.isArray(newdata)) {
				for (var i = 0; i < data.length && i < newdata.length; i++)
					$.extend(data[i], newdata[i]);
				for (var i = data.length; i < newdata.length; i++)
					data.push(newdata[i]);
			} else
				// Asumimos que los datos son objetos
				$.extend(data, newdata);
			console.log('module ' + This.name() + ' extend: extended =', data);
			return This;
		};
		
		this.on = function(evnames, handler, replace) {
			var evs = evnames.split(',');
			evs.forEach(function(e) {
				var evname = e.trim();
				if (!events[evname] || replace)
					events[evname] = [];
				events[evname].push(handler);
			});
			return This;
		};
		
		this.off = function(evnames) {
			if (evnames === undefined)
				events = {};
			else {
				var evs = evnames.split(',');
				evs.forEach(function(e) {
					var evname = e.trim();
					delete events[evname];
				});
			}
			return This;
		};
		
		this.verifier = function(f) {
			verifier = f;
			return This;
		}
		
		this.parser = function(f) {
			parser = f;
			return This;
		};

		this.encoder = function(f) {
			encoder = f;
			return This;
		};

		this.parameters = function(p, value) {
			if (p === undefined) 
				return parameters;
			else if (typeof p === 'string') {
				if (value === undefined)
					return parameters[p];
				else {
					parameters[p] = value;
					return This;
				}
			} else if (p instanceof dolly.Parameters) 
				parameters = p;
			else
				value ? parameters.extend(p) : parameters = new dolly.Parameters(p);
			return This;
		};

		this.bind = function(newdata) {
			var d = newdata || data;
			console.log('rebinding data in mode ' + mode, d);
			for (var v in interfaces)
				if (mode == 'insert')
					interfaces[v].view.bind(d);
				else
					interfaces[v].view.updateAll(d);
			return This;
		};

		this.create = function(params) {
			var erase = function(o) {
				for (var key in o)
					switch (typeof o[key]) {
						case 'string': o[key] = ''; break;
						case 'boolean': o[key] = false; break;
						case 'object': o[key] = $.isArray(o[key]) ? [] : {}; break;
						case 'number': o[key] = 0; break;
						default: o[key] = null; break;
					}
			};
			raise('beforeCreate');
			if ($.isArray(data))
				data.forEach(erase);
			else
				erase(data);
			This.extend(params); console.log('CREATED: ', params, data);
			raise('afterCreate');
			for (var v in interfaces)
				interfaces[v].view.bind(data);
			valid = true;
			raise('endCreate');
			return This;
		};

		this.fetch = function(params, callback) {
			raise('beforeFetch');
			switch (typeof source) {
				case 'string':
					$.nimbus.getJSON(parameters.extend(params).getQueryString(dolly.config.resolve(source)), function(response) { 
						try {
							if (!verify(response)) {
								dolly.config.get('onFailedVerify')(response);
								raise('failedVerify', response);
								valid = false;
							} else {
								data = parse(response);
								valid = true;
							}
						} catch (e) {
							console.log('dolly: Module ' + This.name() + ': error parsing data [' + e + ']');
							valid = false;
						}
						raise('afterFetch', response);
						This.bind(data);
						raise('endFetch');
						if (callback && typeof callback == 'function')
							callback();
					}).fail(function(jqxhr, textStatus, error) {
						console.log('dolly: Module ' + This.name() + ': error retrieving data [' + textStatus + ', ' + error + ']');
						dolly.config.get('onFailedFetch')(jqxhr);
						raise('failedFetch', jqxhr);
						raise('endFetch');
						valid = false;
					});
					break;
				case 'object':
					data = source;
					raise('afterFetch');
					This.bind(data);
					raise('endFetch');
					valid = true;
					break;
				default:
					break;
			}
			return This;
		};
		
		this.filter = function(selector) {
			if (selector && $.isArray(data)) {
				var filtered = data.filter(selector);
				for (var v in interfaces)
					interfaces[v].view.bind(filtered);
			}
			return This;
		};

		this.capture = function(viewNames) {
			var names = $.isArray(viewNames) ? viewNames : viewNames.split(',');
			return names.every(function(n) {
				var qn = 'dolly: Module \'' + This.name() + '\', view \'' + n.trim() + '\': ';
				var ui = interfaces[n.trim()];
				console.log(qn + 'capture started, data = ', data);
				if (ui === undefined) {
					console.log(qn + 'cannot capture, undefined view \'' + n + '\'');
					return false;
				}
				var result = ui.view.capture();
				if (result === undefined) {
					console.log(qn + 'cannot capture, no result from view');
					return false;
				}
				console.log(qn + 'captured [data, ui, result] =', data, ui, result);

				if ($.isArray(result) && $.isArray(data)) {
					console.log(qn + 'result is an array:');
					for (var i = 0; i < data.length && i < result.length; i++)
						$.extend(data[i], result[i]);
					for (var i = data.length; i < result.length; i++)
						data.push(result[i]);
				} else if (typeof result == 'object') {
					console.log(qn + 'result is an object:');
					if ($.isArray(data) && data.length == 0) data[0] = {};
					if (ui.property === undefined)
						$.extend($.isArray(data) ? data[0] : data, result);
					else {
						var prop = {};
						prop[ui.property] = result;
						$.extend($.isArray(data) ? data[0] : data, prop);
						console.log('------ captured to property ' + ui.property, result, data);
					}
				} else {
					console.log(qn + 'cannot extend:', data, result);
					return false;
				}
				console.log(qn + 'capture ended, data = ', data);
				return true;
			})
		};
		
		this.validate = function() {
			return (events['validate'] || []).every((test) => {
				for (var key in data)
					if (!test(key, data))
						return false;
				return true;
			});
		};

		this.save = function(index) {
			if (!valid) {
				console.log('dolly: Module \'' + name + '\': cannot save, invalid module');
				raise('endSave');
				return This;
			}
			if (!target) {
				console.log('dolly: Module \'' + name + '\': cannot save, undefined target url');
				raise('endSave');
				return This;
			}
			if (events['validate']) {
				var pass = events['validate'].every(function(test) {
					for (var key in data)
						if (!test(key, data))
							return false;
					return true;
				});
				if (!pass) {
					console.log('dolly: Module \'' + name + '\': cannot save, validation failed');
					return This;
				}
			}
			console.log('dolly: Module \'' + name + '\': data before save:', data);
			if (events['beforeSave'] && !events['beforeSave'].every(function(handler) {return handler(This, data);})) {
				console.log('dolly: Module \'' + name + '\': save failed, some beforeSave event handler returned false');
				raise('failedSave');
				return This;
			}
			var pack = $.isArray(data) ? data[index || 0] : data; console.log('PACK', pack)
			var encoded = encoder ? encoder(pack) : $.param(pack); console.log('[pack, encoded] =', pack, encoded);
			$.post(dolly.config.resolve(target), encoded, function(response, textStatus, jqXHR) {
				raise('afterSave', response);
			}).fail(function(jqxhr, textStatus, error) {
				console.log('dolly: Module \'' + name + '\': error posting data [' + textStatus + ', ' + error + ']');
				raise('failedSave', jqxhr);
				valid = false;
			});
			raise('endSave');
			return This;
		};
		
		this.view = function(name, view, property) {
			if (view === undefined)
				return interfaces[name].view;
			else {
				view.module(This);
				interfaces[name] = {view: view, property: property};
				return This;
			}
		};
		
		this.clearViews = function() {
			$.each(interfaces, function(name, interface) {interface.view.clear();});
			raise('clear');
			return This;
		};
		
		this.interval = function(lapse, forced) {
			var halt = function() {
				if (intervalId) {
					clearInterval(intervalId);
					intervalId = null;
				}
				intervalCount = 0; console.log('HALTED');
			};
			if (lapse) {
				if (forced || !intervalId) {
					halt();
					intervalId = setInterval(function() {
						raise('interval', ++intervalCount);
					}, lapse);
				}
			} else
				halt();
			return This;
		};
		
		return This;
	},

	View: function(root, template) { //, data, handlers) {
		var This = this;
		var selector = '[dy-template="' + template + '"]';
		var master = $(root || document).find(selector).addBack(selector);
		var position = master.attr('dy-position') || 'bottom';
		var singleObject = (master.attr('dy-clone') === undefined || master.attr('dy-clone') != 'true'); // true;
		var objectCount = 1;
		var cloned = false;
		var eventHandlers = {};
		var customHandlers = null;
		var views = [];
		var controls = {};
		var parser = null;
		var module = null;
		var storage = {};
		var allowEmptyFields = false;
		var json;
		
		var fixedHeader = $(root || document).find('[dy-role=fixed-header]');
		var noResult = $(root || document).find('[dy-role=no-result]');

		this.module = function(mod) {
			if (mod === undefined)
				return module;
			else {
				module = mod;
				return This;
			}
		};
		
		this.allowEmptyFields = function(flag) {
			if (flag === undefined)
				return allowEmptyFields;
			else {
				allowEmptyFields = flag;
				return This;
			}
		};
		
		this.control = function(name, ctrl) {
			if (ctrl === undefined)
				return controls[name];
			else {
				controls[name] = ctrl;
				return This;
			}
		};
		
		this.handlers = function(h) {
			customHandlers = h;
			return This;
		};
		
		this.bind = function(userData, userEvents) {
			console.log('dolly.View: REQUESTED BIND TO ' + template, userData, master);
			if (userData === undefined) 
				return This;
			if (parser)
				userData = parser(userData);
			if ($.isArray(userData)) {
				singleObject = false;
			} else {
				userData = [userData];
				singleObject = true;
			}
			objectCount = userData.length;
			if (!master.length) {
				console.log('dolly: view: template "' + template + '" not found at:', root);
				return;
			}
			if (master.attr('dy-clone') == 'true') {
				//console.log('dolly.View: CLONE ' + template, userData, master);
				var parent = master.parent();
				parent.scrollTop(0);
				cloned = true;
				for (var i = 0; i < userData.length; i++) {
					//console.log('about to clone');
					var element = master.clone();
					element.removeAttr('dy-template').removeAttr('dy-clone');
					element.attr('dy-instance', template);
					var dyid = element.attr('dy-id');
					if (dyid) {
						var dybind = element.attr('dy-bind');
						element.attr('dy-bind', (dybind ? dybind + ';' : '') + 'dy-id:[[' + dyid + ']]');
					}
					views.push(element);
					switch (position) {
						case 'before': master.before(element); break;
						case 'after': master.after(element); break;
						case 'top': parent.prepend(element); break;
						case 'bottom':
						default: parent.append(element); break;
					}
					bind(element, userData[i], userEvents);
				} 
			} else {
				//console.log('dolly.View: SINGLE ' + template, userData, master);
				cloned = false;
				if (!views.length)
					views.push(master);
				bind(master, userData[0], userEvents);
			}
			if (eventHandlers['end'])
				eventHandlers['end'](This);
				
			console.log('view count', views.length);

			if (fixedHeader.exists()) {
				var alignParams = (fixedHeader.attr('dy-alignto') || 'undefined').split(',');
				var ref = $(root || document).find('[dy-instance=' + alignParams[0] + ']').first();
				var dad = ref.parents('.scrollable').first();
				var	adjust = () => {
					var overflowed = (dad.prop('scrollHeight') > dad.height());
					fixedHeader
						.css('width', overflowed && $.scrollbarWidth() ? 'calc(100% - ' + $.scrollbarWidth() + 'px)' : 'auto')
						.fadeTo(200, 1);
				};
				if (ref.exists()) {
					//var adjustId;
					var align = function() {
						//clearTimeout(adjustId);
						fixedHeader.fadeTo(100, .3);
						fixedHeader.children().each(function(i, e) {
							var child = ref.closestDown('tr').children('td:nth-child(' + (i + 1) + ')');
							$(this).width(child.width()).attr('title', $(this).text());
						});
						//adjustId = setTimeout(adjust, 250);
						adjust();
						fixedHeader.fadeTo(200, 1);
						console.log('dolly.View: fixed header aligned');
					};
					//fixedHeader.on('dblclick', align)
					fixedHeader.empty();					
					ref.parent().closestDown('tr').children('th').each(function() {
						$('<div>')
							.attr('class', $(this).attr('class'))
							.html($(this).html())
							.appendTo(fixedHeader);
					});
					
					align();
					var namespace = '.dolly.view.' + template;
					$(window).off('resize' + namespace).on('resize' + namespace, $.debounce(align));
					fixedHeader.on('resize' + namespace, $.debounce(align));
					
					var resizeOn = alignParams[1];
					if (resizeOn && $(resizeOn).exists()) {
						$(resizeOn).off('transitionstart' + namespace).on('transitionstart' + namespace, () => {fixedHeader.fadeTo(100, .3);});
						$(resizeOn).off('transitionend' + namespace).on('transitionend' + namespace, align);
					}
					
					fixedHeader.children().each(function(index, element) {
						$(element).on('click', function() {
							if (!cloned) return;
							var orderBy = $(element).index() + 1;
							var lastOrderBy = fixedHeader.attr('last-order-by');
							var lastDirection = fixedHeader.attr('last-order-dir') || 1;
							var direction = (orderBy == lastOrderBy ? -lastDirection : 1);
							var parent = master.parent();
							var rowset = parent.children('[dy-instance=' + template + ']');
							rowset.find('[sorted]').removeAttr('sorted');
							fixedHeader.find('[sorted]').removeAttr('sorted');
							rowset.find('td:nth-child(' + orderBy + ')').attr('sorted', '');
							rowset.sort(function(n1, n2) {
								var val = function(e) {
									var v = e.attr('dy-order-data');
									if (v === undefined) v = e.text();
									var orderType = (e.attr('dy-order-type') || '').split(':');
									switch (orderType[0]) {
										case 'number': return parseFloat(v);
										case 'date':   return v ? new Date(orderType[1] ? moment(v, orderType[1]) : v) : undefined;
										default: return v;
									}
								};
								var value1 = val($(n1).find('*td:nth-child(' + orderBy + ')'));
								var value2 = val($(n2).find('*td:nth-child(' + orderBy + ')'));
								if (value2 === undefined || value1 > value2)
									return direction;
								else if (value1 === undefined | value1 < value2)
									return -direction;
								else
									return 0;
							});
							rowset.detach().appendTo(parent);
							$(element).attr('sorted', direction);
							fixedHeader.attr('last-order-by', orderBy).attr('last-order-dir', direction);
						});
					});
					fixedHeader./*children().*/css({visibility: 'visible'});
					noResult.hide();
				} else {
					fixedHeader./*children().*/css({visibility: 'hidden'});
					noResult.show();
				}
			}
			return This;
		};
		
		var getFields = function(stencil) {
			//var re = /\[\[(\*|\w+)\]\]/g;
			//var re = /\[\[(\*|[\w\|]+)\]\]/g;
			//var re = /\[\[(\*|\w+(?:\|.+)?)\]\]/g;
			var re = /\[\[(\*|\#|[\.\w]+(?:\|.+)?)\]\]/g;
			var fields = [];
			var matched, i = 10;
			while ((matched = re.exec(stencil)) && i--) {
				var fld = matched[1];
				if ($.inArray(fld, fields) == -1)
					fields.push(fld);
			} 
			return fields;
		};

		var extract = function(obj, prop) {
			var path = prop.split('.');
			var o = obj;
			for (var i = 0; o !== undefined && i < path.length; i++)
				o = o[path[i]];
			return o;
		}

		var instance = function(fieldDef, expression, dict, updateMode) { 
			var isEmpty = function(x) {return x === undefined || x === null;};
			var fieldName = fieldDef[0];
			var defaultValue = fieldDef.length == 2 ? fieldDef[1] : undefined;
			var data;
			if (fieldName == '#')
				data = objectCount;
			else {
				var prop = extract(dict, fieldName);
				//if (updateMode && isEmpty(prop))
				//	return;
				data = (dict && !isEmpty(prop)) ? prop : '';
			}
			if (defaultValue !== undefined) data = data || defaultValue;
			if (eventHandlers['instance-attempt']) 
				eventHandlers['instance-attempt'].call(This, fieldName, expression, dict);
			if (eventHandlers['bind']) 
				data = eventHandlers['bind'].call(This, fieldName, data, dict);
			var pattern = '[[' + fieldDef.join('|') + ']]';			
			var replaced = expression.replace(pattern, data);
			while (replaced != expression) {
				expression = replaced;
				replaced = expression.replace(pattern, data);
			}
			return expression;
		};

		var bindElement = function(element, record, updateMode) {
			var ats = element.attr('dy-bind').split(';');
			var repeat = 1;
			element.removeAttr('dy-invalid');
			for (var i = 0; i < ats.length; i++) {
				var pair = ats[i].split(':');
				var attribute = pair.length == 1 ? 'html' : pair[0];
				var expression = pair.length == 1 ? pair[0] : pair[1];
				var boolean = false, negated = false;
				if (expression.charAt(0) == '?') {
					expression = expression.substr(1);
					boolean = true;
					if (expression.charAt(0) == '!') {
						expression = expression.substr(1);
						negated = true;
					}
				} 
				var fields = getFields(expression); //console.log('fields', fields);
				var untouched = true;
				for (var f = 0; f < fields.length; f++) {
					//var field = fields[f]; //console.log('bind', fields, field, record);
					var fieldExp = fields[f].split('|'); //console.log('bind', fields, field, record);
					var field = fieldExp[0];
																			//	console.log('instance before:', field, expression, record);
					expression = instance(fieldExp, expression, record, updateMode); 	//	console.log('instance after:', field, expression, record);
					
					var isValued = (attribute == 'value') || (element.prop('tagName').toLowerCase() == 'textarea');
					var isInput = (element.attr('dy-input') !== undefined) || (element.attr('dy-hidden') !== undefined);
					if (isValued && isInput) {
						var role = element.attr('dy-role');
//console.log('role, elem, elem:dollyCtrl, bindings[field]', role, elem, elem.data('dollyCtrl'), bindings[field]);
						var ctrl = element.data('dollyCtrl');
						switch (role) {
							case 'checkbox':
								if (!ctrl) { 
									var ctrl = new dolly.Checkbox(element, element.attr('dy-label'));
									if (eventHandlers['control'])
										eventHandlers['control'](field, ctrl, record, element);
									element.data('dollyCtrl', ctrl);
									if (element.attr('id'))
										controls[element.attr('id')] = ctrl;
								}
								break;
							case 'dropdown':
								if (!ctrl) {
									var ctrl = new dolly.DropDown(element);
									if (eventHandlers['control'])
										eventHandlers['control'](field, ctrl, record, element);
									element.data('dollyCtrl', ctrl);
									if (element.attr('id'))
										controls[element.attr('id')] = ctrl;
								}
								break;
							default:
								var tagName = element.prop('tagName').toLowerCase();
								if (tagName == 'input') {
									var ctrl = new dolly.Textbox(element);
									if (eventHandlers['control'])
										eventHandlers['control'](field, ctrl, record, element);
									element.data('dollyCtrl', ctrl);
									if (element.attr('id'))
										controls[element.attr('id')] = ctrl;
								} else if (['select', 'textarea'].indexOf(tagName) != -1)
									element.data('dollyCtrl', null);
								else if (!ctrl) {
									var ctrl = new dolly.Hidden(element); console.log('added hidden', element);
									if (eventHandlers['control'])
										eventHandlers['control'](field, ctrl, record, element);
									element.data('dollyCtrl', ctrl);
									if (element.attr('id'))
										controls[element.attr('id')] = ctrl;
								}
								break;
						}
						bindings[field] = element;
					}
				}
				if (attribute == 'html')
					element.html(expression);
				else if (boolean) {
					switch (expression) {
						case 'false': 
						case '0': expression = false; break;
						default: expression = !!expression; break;
					}
					(negated ? !expression : expression) ? element.attr(attribute, '') : element.removeAttr(attribute);
				} else if (attribute == '*') {
					repeat = parseInt(expression);
				} else
					element.attr(attribute, expression);
				if (attribute == 'value' && element.data('dollyCtrl') && element.data('dollyCtrl').set)
					element.data('dollyCtrl').set(true); // set quiet
				if (attribute == 'value' && ['input', 'textarea'].indexOf(element.prop('tagName').toLowerCase()) != -1) {
					element.val(expression);
					if (element.attr('placeholder') !== undefined) 
						element.focus().blur();
				}
				// Verificar solicitud de repeticion
				if (!isNaN(repeat)) {
					if (repeat > 1) {
						element.attr('dy-repeat', 1);
						for (var r = 2; r <= repeat; r++) {
							var cloned = element.clone();
							cloned.removeAttr('dy-bind').attr('dy-repeat', r);
							cloned.prependTo(element.parent());
						}
					} else if (repeat == 0) {
						element.remove();
					}
				}
			}
		};

		var bind = function(view, record, handlers, updateMode) { //console.log('bind:', view, record, handlers)
			var bindings = view.data('bindings') || {}; //{}; 
			var exclusions = view.find('[dy-template] *, [dy-instance], [dy-instance] *');
//			(view.attr('dy-bind') ? view : $()).add(view.find('[dy-bind]')).each(function(ndx) {
			(view.attr('dy-bind') ? view : $()).add(view.find('[dy-bind]').not(exclusions)).each(function(ndx) {
				var elem = $(this).removeAttr('dy-invalid');
				var ats = elem.attr('dy-bind').split(';');
				var repeat = 1;
				for (var i = 0; i < ats.length; i++) {
					var pair = ats[i].split(':');
					var attribute = pair.length == 1 ? 'html' : pair[0];
					var expression = pair.length == 1 ? pair[0] : pair[1];
					var boolean = false, negated = false;
					if (expression.charAt(0) == '?') {
						expression = expression.substr(1);
						boolean = true;
						if (expression.charAt(0) == '!') {
							expression = expression.substr(1);
							negated = true;
						}
					} 
					var fields = getFields(expression); //console.log('fields', fields);
					var untouched = true;
					for (var f = 0; f < fields.length; f++) {
						//var field = fields[f]; //console.log('bind', fields, field, record);
						var fieldExp = fields[f].split('|'); //console.log('bind', fields, field, record);
						var field = fieldExp[0];
																				//	console.log('instance before:', field, expression, record);
						expression = instance(fieldExp, expression, record, updateMode); 	//	console.log('instance after:', field, expression, record);
						
						var isValued = (attribute == 'value') || (elem.prop('tagName').toLowerCase() == 'textarea');
						var isInput = (elem.attr('dy-input') !== undefined) || (elem.attr('dy-hidden') !== undefined);
						if (isValued && isInput) {
							var role = elem.attr('dy-role');
//console.log('role, elem, elem:dollyCtrl, bindings[field]', role, elem, elem.data('dollyCtrl'), bindings[field]);
							var ctrl = elem.data('dollyCtrl');
							switch (role) {
								case 'checkbox':
									if (!ctrl) { 
										var ctrl = new dolly.Checkbox(elem, elem.attr('dy-label'));
										if (eventHandlers['control'])
											eventHandlers['control'](field, ctrl, record, elem);
										elem.data('dollyCtrl', ctrl);
										if (elem.attr('id'))
											controls[elem.attr('id')] = ctrl;
									}
									break;
								case 'dropdown':
									if (!ctrl) {
										var ctrl = new dolly.DropDown(elem);
										if (eventHandlers['control'])
											eventHandlers['control'](field, ctrl, record, elem);
										elem.data('dollyCtrl', ctrl);
										if (elem.attr('id'))
											controls[elem.attr('id')] = ctrl;
									}
									break;
								case 'select':
									if (!ctrl) {
										var ctrl = new dolly.Select(elem);
										if (eventHandlers['control'])
											eventHandlers['control'](field, ctrl, record, elem);
										elem.data('dollyCtrl', ctrl);
										if (elem.attr('id'))
											controls[elem.attr('id')] = ctrl;
									}
									break;
								default:
									var tagName = elem.prop('tagName').toLowerCase();
									if (tagName == 'input') {
										var ctrl = new dolly.Textbox(elem);
										if (eventHandlers['control'])
											eventHandlers['control'](field, ctrl, record, elem);
										elem.data('dollyCtrl', ctrl);
										if (elem.attr('id'))
											{controls[elem.attr('id')] = ctrl; console.log('added Textbox', elem)};
									} else if (['select', 'textarea'].indexOf(tagName) != -1)
										elem.data('dollyCtrl', null);
									else if (!ctrl) {
										var ctrl = new dolly.Hidden(elem); console.log('added hidden', elem);
										if (eventHandlers['control'])
											eventHandlers['control'](field, ctrl, record, elem);
										elem.data('dollyCtrl', ctrl);
										if (elem.attr('id'))
											controls[elem.attr('id')] = ctrl;
									}
									break;
							}
							bindings[field] = elem;
						}
					}
					if (attribute == 'html')
						elem.html(expression); 
					else if (boolean) {
						switch (expression) {
							case 'false': 
							case '0': expression = false; break;
							default: expression = !!expression; break;
						}
						(negated ? !expression : expression) ? elem.attr(attribute, '') : elem.removeAttr(attribute);
					} else if (attribute == '*') {
						repeat = parseInt(expression);
					} else
						elem.attr(attribute, expression);
					if (attribute == 'value' && elem.data('dollyCtrl') && elem.data('dollyCtrl').set)
						elem.data('dollyCtrl').set(true); // set quiet
					if (attribute == 'value' && ['input', 'textarea'].indexOf(elem.prop('tagName').toLowerCase()) != -1) {
						elem.val(expression);
						if (elem.attr('placeholder') !== undefined) 
							elem.focus().blur();
					}
					// Verificar solicitud de repeticion
					if (!isNaN(repeat)) {
						if (repeat > 1) {
							elem.attr('dy-repeat', 1);
							for (var r = 2; r <= repeat; r++) {
								var cloned = elem.clone();
								cloned.removeAttr('dy-bind').attr('dy-repeat', r);
								cloned.prependTo(elem.parent());
							}
						} else if (repeat == 0) {console.log('0', elem);
							elem.remove();}
					}
				}
			});
			(view.attr('dy-events') ? view : $()).add(view.find('[dy-events]')).each(function(ndx) {
				var h = handlers || customHandlers;
				if (!h) return;
				var elem = $(this); //console.log('dy-events on:', elem);
				var evs = elem.attr('dy-events').split(';');
				for (var i = 0; i < evs.length; i++) {
					var pair = evs[i].split(':');
					var evname = pair[0];
					var evhandler = pair[pair.length == 2 ? 1 : 0];
					if (!elem.data('dolly-events'))
						elem.data('dolly-events', []);
					if (!elem.data('dolly-events').includes(evname) && h[evhandler]) {
						if (elem.data('dollyCtrl') && elem.attr('dy-role'))
							elem.data('dollyCtrl').on(evname, h[evhandler]);
						else
							elem.on(evname, {container: view, source: record, view: This}, h[evhandler]);
						elem.data('dolly-events').push(evname);
					}
				}
			});

			view.data('bindings', bindings);
			if (eventHandlers['instance'])
				eventHandlers['instance'](view, record);
		};
		this.elements = function(selector) {
			var running = $();
			views.forEach(function(one) {
				running = running.add(selector ? one.find(selector).addBack(selector) : one);
			});
			return running;
		};
		this.$ = function() {
			return $(views);
		};
		this.on = function(evname, handler) {
			if (typeof handler == 'function')
				eventHandlers[evname] = handler;
			return This;
		};
		this.off = function(evname) {
			if (eventHandlers[evname])
				delete eventHandlers[evname];
			return This;
		};
		this.parser = function(f) {
			if (typeof f == 'function')
				parser = f;
			return This;
		}
		this.position = function(newpos) {
			if (newpos === undefined)
				return position;
			else {
				position = newpos;
				return This;
			}
		};
		this.read = function(view) {
			alert('calling deprecated view.read');
			var resp = [];
			for (var i = 0; i < views.length; i++) {
				if (view && views[i] !== view) continue;
				var bindings = views[i].data('bindings');
				var data = {};
				for (var field in bindings) {
					var elem = bindings[field], ctrl = elem.data('dollyCtrl'); 
					data[field] = ctrl ? ctrl.query() : elem.val();
					elem.removeAttr('dy-invalid');
				}
				if (eventHandlers['validate'])
					for (var key in data) {
						if (!eventHandlers['validate'](key, data, bindings)) {
							bindings[key].attr('dy-invalid', '');
							return undefined;
						}
					}
				resp.push(data);
			}
			return resp;
		};
		
		this.update = function(view, record) {
			bind(view, record, undefined, true);
		};
		
		this.updateAll = function(data) {
			var userData = parser ? parser(data) : data;
			var idname = master.attr('dy-id');
			if (idname && $.isArray(userData)) {
				for (var i = 0; i < views.length; i++) {
					var element = views[i];
					var idvalue = element.attr('dy-id');
					var records = userData.filter(r => r[idname] == idvalue);
					if (records.length == 1) {
						console.log('UPDATING', element, records);
						bind(element, records[0], undefined, true);
					}
				}
			}
		};
		
		this.capture = function(view) {
			console.log('Capturing ' + (view ? 'selected view' : 'all views') + ' from ' + (cloned ? 'cloned' : 'single') + ' template', template, 'START!');
			var resp = [];
			for (var i = 0; i < views.length; i++) {
				if (view && views[i] !== view) continue;
				var bindings = views[i].data('bindings'); //console.log('bindings', bindings);
				var data = {};
				for (var field in bindings) {
					var elem = bindings[field], ctrl = elem.data('dollyCtrl');
					data[field] = ctrl ? ctrl.value() : elem.val();
					if ((allowEmptyFields || elem.attr('dy-allowempty') !== undefined) && elem.is('input') && !data[field]) {
						data[field] = String.fromCharCode(127);
						console.log('forced 127');
					}
					//data[field] = ctrl ? ctrl.value() : elem.val(); 
					console.log('data[\'' + field + '\'] = ' + data[field]);
					elem.removeAttr('dy-invalid');
				}
				if (eventHandlers['validate'])
					for (var key in data) {
						if (!eventHandlers['validate'](key, data, bindings)) { 
							bindings[key].attr('dy-invalid', '');
							return undefined;
						}
					}
				console.log('requested view', view, 'current', i, views[i], 'gathered data', data);
				resp.push(data);
			}
			if (!cloned)
				resp = resp[0];
			console.log('view from template', template, 'cloned?', cloned, 'resp =', resp);
			return eventHandlers['capture'] ? eventHandlers['capture'](resp) : resp;
		};
		
		this.serialize = function(view) {
			var resp = This.read(view);
			if (resp === undefined) 
				return '';
			else
				return eventHandlers['serialize'] ? resp.map(eventHandlers['serialize']) : JSON.stringify(resp); 
		};
		
		this.clear = function() { console.log('clearing', template);
			if (cloned) {
				$(root || document).find('[dy-instance=' + template + ']').remove();
				views = [];
				console.log('cleared', template);
			} /*else
				for (var i = 0; i < views.length; i++) {
					var bindings = views[i].data('bindings'); console.log('bindings of view ' + i, bindings)
					for (var f in bindings) {
						var elem = bindings[f], ctrl = elem.data('dollyCtrl');
						ctrl ? ctrl.clear() : elem.val('');
						elem.removeAttr('dy-invalid');
					}
				}*/
			return This;
		};
		
		this.data = function(key, value) {
			if (key === undefined)
				return This;
			else if (value === undefined)
				return storage[key];
			else {
				storage[key] = value;
				return This;
			}
		};
/*		
		this.sort = function(selector) {
			if (!cloned) return;
			var parent = master.parent();
			var lastSelector = parent.attr('order-selector');
			var lastDirection = (parent.attr('order-direction') || 'asc') == 'asc' ? 1 : -1;
			if (selector === undefined) 
				return {selector: lastSelector, direction: lastDirection};
			else {
				var direction = (selector == lastSelector ? -lastDirection : 1);
				var set = parent.children('[dy-instance=' + template + ']');
				set.find(lastSelector).removeAttr('ordered');
				set.find(selector).attr('ordered', '');
				set.sort(function(n1, n2) {
					var value1 = $(n1).find(selector).text(); //attr('order-data');
					var value2 = $(n2).find(selector).text(); //attr('order-data');
					if (value1 > value2)
						return direction;
					else if (value1 < value2)
						return -direction;
					else
						return 0;
				});
				set.detach().appendTo(parent);
				parent.attr('order-selector', selector).attr('order-direction', direction == 1 ? 'asc' : 'desc');
				return This;
			}
		};
*/
		this.sort = function(selector, direction) {
			if (!cloned) return;
			var parent = master.parent();
			var set = parent.children('[dy-instance=' + template + ']');
			set.find(lastSelector).removeAttr('ordered');
			set.find(selector).attr('ordered', '');
			set.sort(function(n1, n2) {
				var value1 = $(n1).find(selector).text(); //attr('order-data');
				var value2 = $(n2).find(selector).text(); //attr('order-data');
				if (value1 > value2)
					return direction;
				else if (value1 < value2)
					return -direction;
				else
					return 0;
			});
			set.detach().appendTo(parent);
			return This;
		};
		
		this.isCloned = function() {return cloned;};
		
		return This;
	},
	
	Uploader: function(url, responseType) {
		var This = this;
		var request = null;
		var tests = {
			filereader: typeof FileReader != 'undefined',
			dnd: 'draggable' in document.createElement('span'),
			formdata: !!window.FormData,
			progress: "upload" in new XMLHttpRequest
		};
		var success = null;
		var error = function(s) {alert(s);};
		var complete = null;
		var parameters = null;
		var events = {};
		var payload = null;
		
		var url = url;
		var responseType = responseType || 'json';

		var raise = function(evname, params) {
			if (events[evname]) 
				events[evname].forEach(function(handler) {handler(This, params);})
		};

		var init = function() {
			request = new XMLHttpRequest();
			request.onreadystatechange = function() { 
				if (request.readyState == 4) {
					if (request.status == 200)
						switch (responseType) {
							case 'XML': 
							case 'xml': raise('success', request.responseXML); break;
							case 'JSON': 
							case 'json': raise('success', JSON.parse(request.responseText)); break;
							default: raise('success', request.responseText); break;
						}
					else
						raise('error', request.status);
				}
			};
		};

		this.url = function(u) {
			if (u === undefined)
				return url;
			else {
				url = u;
				return This;
			}
		};
		this.responseType = function(rt) {
			if (rt === undefined)
				return responseType;
			else {
				responseType = rt;
				return This;
			}
		};
		this.on = function(evnames, handler, replace) {
			if (handler === undefined)
				return events[evnames.split(',')[0]];
			else if (typeof handler == 'function') {
				var evs = evnames.split(',');
				evs.forEach(function(e) {
					var evname = e.trim();
					if (!events[evname] || replace)
						events[evname] = [];
					events[evname].push(handler);
				});
			}
			return This;
		};
		this.off = function(evnames) {
			if (evnames === undefined)
				events = {};
			else {
				var evs = evnames.split(',');
				evs.forEach(function(e) {
					var evname = e.trim();
					delete events[evname];
				});
			}
			return This;
		};
		this.parameters = function(p) {
			if (p === undefined)
				return parameters;
			else if (typeof p == 'string')
				return parameters[p];
			else {
				parameters = p;
				return This;
			}
		};
		this.progress = function(f) {
			if (typeof f == 'function') {
				if (tests.progress) 
					request.upload.onprogress = function(ev) {
						if (ev.lengthComputable)
							f(ev.loaded / ev.total * 100 | 0);
					};
				else
					console.log('dolly: Uploader: this browser doesn\'t support XMLHttpRequest upload progress.');
			}
			return This;
		};
		this.droppable = function(el, draggingClass) {
			$(el)
				.off('dragover')
				.on('dragover', function(ev) {
					ev.preventDefault(); 
					if (draggingClass) $(el).addClass(draggingClass);
					return false;
				})
				.off('dragleave')
				.on('dragleave', function(ev) {
					ev.preventDefault(); 
					if (draggingClass) $(el).removeClass(draggingClass);
					return false;
				})
				.off('drop')
				.on('drop', function(ev) {
					ev.preventDefault(); console.log(ev);
					if (draggingClass) $(el).removeClass(draggingClass);
					console.log('dolly: Uploader: requested upload of ' + ev.originalEvent.dataTransfer.files[0].name);
					raise('drop', {target: $(el), file: ev.originalEvent.dataTransfer.files[0]});
				});
			return This;
		};
		this.upload = function(key, file) {
			payload = file;
			init();
			if (tests.progress) 
				request.upload.onprogress = function(ev) {
					if (ev.lengthComputable)
						raise('progress', ev.loaded / ev.total * 100 | 0);
				};
			else
				console.log('dolly: Uploader: this browser doesn\'t support XMLHttpRequest upload progress.');
			if (tests.formdata) {
				raise('startUpload', file);
				var formData = new FormData();
				formData.append(key, file);
				request.open('POST', (new dolly.Parameters(parameters)).getQueryString(dolly.config.resolve(url)));
				request.onload = complete;
				request.send(formData);
			} else
				console.log('dolly: Uploader: this browser doesn\'t support FormData.');
			return This;
		};
		this.abort = function() {
			request.abort();
		};
		this.cancel = function(flag) {
			cancel = flag;
			return This;
		};
		this.payload = function() {
			return payload;
		};
		return This;
	},

	Parameters: function(params) {
		var This = this;
		
		$.extend(This, params || {});
		
		this.extend = function(p) {
			$.extend(This, p); //console.log('extend with ', p, This, This.getQueryString('///'));
			return This;
		};
		this.all = function() {
			var obj = {};
			$.each(This, function(key, value) {
				if (typeof value != 'function')
					obj[key] = value;
			});
			return obj;
		};
		this.getQueryString = function(url) {
			var qs = [];
			$.each(This, function(key, value) {
				switch (typeof value) {
					case 'number': qs.push(key + '=' + value); break;
					case 'string': 
						switch (value) {
							case 'true': qs.push(key + '=1'); break;
							case 'false': qs.push(key + '=0'); break;
							default: qs.push(key + '=' + encodeURIComponent(value)); break;
						} break;
					case 'boolean': qs.push(key + '=' + (value ? 1 : 0)); break;
				}
			});
			if (url)
				return url + (url.indexOf('?') == -1 ? '?' : '&') + qs.join('&');
			else
				return qs.join('&');
		};
		this.order = function(newOrdId) {
			if (newOrdId === undefined)
				return This.ordId;
			else if (This.ordId == newOrdId)
				This.inverse = !This.inverse;
			else {
				This.ordId = newOrdId;
				This.inverse = false;
			}
			return This;
		};
		return This;
	},
	
	Dialog: function(parent) {
		var This = this;
		var events = {};
		var controls = {};
		var params = null;
		
		var mode = 'close';
		var dim = $('<div>').attr('dy-role', 'dialog-background-dimmer'); 
		var dialog = parent ? $(parent) : $('<div>').appendTo(document.body);
		var icon = $('<div>').attr('dy-role', 'dialog-icon').append($('<span>'));
		var body = $('<div>').attr('dy-role', 'dialog-body').css('overflow', 'visible');
		var footer = $('<div>').attr('dy-role', 'dialog-footer');
		var status = $('<div>').attr('dy-role', 'status');
		var submit = $('<div>')
			.attr('dy-role', 'button')
			.attr('dy-submit', '')
			.html('Aceptar')
			.on('click', () => {
				var result = {};
				for (key in controls)
					result[key] = controls[key].value();
				if (events['validate']) {
					var test = events['validate'](result);
					if (typeof test == 'string' && test) {
						status.html(test).show();
						setTimeout(() => {status.html('').hide();}, 5000);
						return;
					} else if (test) {
						status.html('Datos inválidos').show();
						return;
					}
				}
				dialog.add(dim).fadeOut(dolly.config.get('dialogDelay'));
				status.html('').hide();
				if (events['encode']) {
					result = events['encode'](result, This);
				}
				if (events['accept']) {
					events['accept'](result, This);
				}
				if (events['end']) {
					events['end'](result)
				}
			});
		var cancel = $('<div>')
			.attr('dy-role', 'button')
			.html('Cancelar')
			.on('click', () => {
				dialog.add(dim).fadeOut(dolly.config.get('dialogDelay'));
				status.html('').hide();
				if (events['cancel'])
					events['cancel']();
				if (events['end']) {
					events['end']()
				}
			});
		footer.append(status, submit, cancel);
		dialog.attr('dy-role', 'dialog').append(icon, body, footer).before(dim);
		
		var verify = function() {
			if (events['verify'])
				return events['verify'](controls);
			else
				return true;
		};

		this.icon = function(mode) {
			// confirm, success, warning, inform, error
			if (mode === undefined)
				return icon.attr('dy-mode');
			else {
				icon.attr('dy-mode', mode);
				return This;
			}
		};
		this.remove = function() {
			This.hide();
			dim.remove();
			parent ? $(parent).children().remove() : dialog.remove();
		};
		this.off = function(evname) {
			if (evname === undefined)
				events = {};
			else
				delete events[evname];
			return This;
		};
		this.on = function(evname, handler) {
			events[evname] = handler;
			return This;
		};
		this.addControl = function(name, controlType, label) {
			var wrapper = $('<div>').attr('dy-role', 'dialog-control').appendTo(body);
			var ctrl;
			switch (controlType) {
			case 'static':
				ctrl = new dolly.Static($('<div>').appendTo(wrapper.attr('dy-role', 'dialog-control-label'))); break;
			case 'textbox':
				ctrl = new dolly.Textbox($('<div>').appendTo(wrapper)); break;
			case 'textarea':
				ctrl = new dolly.Textarea($('<div>').appendTo(wrapper)); break;
			case 'checkbox':
				ctrl = new dolly.Checkbox($('<div>').appendTo(wrapper), label, false); break;
			case 'radio':
				ctrl = (new dolly.Radio($('<div>').appendTo(wrapper), '', false))
					.on('_change_', verify);
				break;
			case 'dropdown':
				ctrl = (new dolly.DropDown($('<div>').appendTo(wrapper)))
					.on('_change_', verify);
				break;
			case 'gauge':
				ctrl = (new dolly.Gauge($('<div>').appendTo(wrapper)));
				break;
			default:
				return undefined;
			}
			if (name)
				controls[name] = ctrl;
			if (label)
				ctrl.label($('<div>').attr('dy-role', 'dialog-control-label').append($('<div>').html(controlType == 'checkbox' ? '' : label)).insertBefore(wrapper));
			return ctrl;
		};
		this.getControl = function(name) {
			return controls[name];
		};
		this.showAll = function(fade) {
			for (ctrl in controls)
				controls[ctrl].show(fade);
			return This;
		};
		this.hideAll = function(fade) {
			for (ctrl in controls)
				controls[ctrl].hide(fade);
			return This;
		};
		this.clearAll = function() {
			for (ctrl in controls)
				controls[ctrl].clear();
			return This;
		};
		this.mode = function(m, submitName, cancelName) {
			if (m === undefined)
				return mode;
			else {
				switch (m) {
					case 'yesno': submit.html('Sí'); cancel.html('No'); break;
					case 'acceptcancel': submit.html('Aceptar'); cancel.html('Cancelar'); break;
					case 'accept': submit.html('Aceptar'); cancel.html(''); break;
					case 'cancel': submit.html(''); cancel.html('Cancelar'); break;
					case 'custom': submit.html(submitName); cancel.html(cancelName); break;
					case 'close':
					default: submit.html('Cerrar'); cancel.html(''); break;
				}
				mode = m;
				return This;
			}
		};
		this.show = function(msg) {
			if (msg) body.html(msg);
			mode == 'cancel' ? submit.hide() : submit.show();
			mode == 'accept' || mode == 'close' ? cancel.hide() : cancel.show();
			status.html('');
			dialog.add(dim).fadeIn(400);
			if (events['show'])
				events['show']();
			return This;
		};
		this.hide = function() {
			dialog.add(dim).fadeOut(dolly.config.get('dialogDelay'));
		};
		return This;
	},

	Static: function(parent, text) {
		var This = this;
		var events = {};

		var static = $('<span>').appendTo($(parent).attr('dy-role', 'static')).html(text);
		
		this.$ = function() {
			return static;
		};
		this.value = function() {
			return static.html();
		};
		this.clear = function() {
			static.html('');
			return This;
		};
		this.css = function(map) {
			static.css(map);
			return This;
		};
		this.mode = function(m) {
			if (m === undefined)
				return $(parent).attr('dy-mode'); 
			else {
				switch (m) {
				case 'normal':
				case 'title':
				case 'warning':
					$(parent).attr('dy-mode', m); break;
				}
				return This;
			}
		};
		this.on = function(evname, handler) {
			events[evname] = handler;
			return This;
		};
		this.text = function(str) {
			if (str === undefined) 
				return static.html();
			else {
				static.html(str);
				return This;
			}
		};
		this.show = function(fade) {
			static.show(fade);
			return This;
		};
		this.hide = function(fade) {
			static.hide(fade);
			return This;
		};
		return This;
	},

	Textbox: function(parent, text, lines) {
		var This = this;
		var label = null;
		var events = {};
		var textbox;
		
		if ($(parent).prop('tagName').toLowerCase() == 'input')
			textbox = $(parent);
		else
			textbox = $('<input>')
				.attr('type', 'text')
				.attr('dy-input', '')
				.addClass('dy-skin')
				.appendTo($(parent).attr('dy-role', 'textbox'))
				.on('focus', function(ev) {
					if (events['focus']) events['focus'](ev);
				})
				.on('blur', function(ev) {
					if (events['blur']) events['blur'](ev);
				})
				.val(text || '');
		
		this.$ = function() {
			return textbox;
		};
		this.clear = function() {
			textbox.val('')
			return This;
		};
		this.enabled = function(flag) {
			if (flag === undefined)
				return textbox.attr('disabled') === undefined;
			else {
				flag ? textbox.removeAttr('disabled') : textbox.attr('disabled', '');
				return This;
			}
		};
		this.readOnly = function(flag) {
			if (flag === undefined)
				return textbox.attr('readonly') !== undefined;
			else {
				flag ? textbox.attr('readonly', '') : textbox.removeAttr('readonly');
				flag ? textbox.parent().attr('readonly', '') : textbox.parent().removeAttr('readonly');
				return This;
			}
		};
		this.on = function(evname, handler) {
			events[evname] = handler;
			return This;
		};
		this.query = this.value = this.text = function(str) {
			if (str === undefined) 
				return textbox.val();
			else {
				textbox.val(str);
				return This;
			}
		};
		this.label = function(lbl) {
			if (lbl === undefined)
				return label;
			else {
				label = $(lbl);
				return This;
			}
		};
		this.show = function(fade) {
			textbox.show(fade);
			if (label) label.show(fade);
			return This;
		};
		this.hide = function(fade) {
			textbox.hide(fade);
			if (label) label.hide(fade);
			return This;
		};
		this.focus = function() {
			textbox.focus();
			return This;
		};
		this.placeholder = function(p) {
			if (p === undefined)
				return textbox.attr('placeholder');
			else {
				textbox.attr('placeholder', p);
				return This;
			}
		};
		return This;
	},

	Textarea: function(parent, text) {
		var This = this;
		var label = null;
		var events = {};
		var textarea;
		
		if ($(parent).prop('tagName').toLowerCase() == 'textarea')
			textarea = $(parent);
		else
			textarea = $('<textarea>')
				.attr('dy-input', '')
				.addClass('dy-skin')
				.appendTo($(parent).attr('dy-role', 'textarea'))
				.on('focus', function(ev) {
					if (events['focus']) events['focus'](ev);
				})
				.on('blur', function(ev) {
					if (events['blur']) events['blur'](ev);
				})
				.val(text || '');
		
		this.$ = function() {
			return textarea;
		};
		this.clear = function() {
			textarea.val('')
			return This;
		};
		this.enabled = function(flag) {
			if (flag === undefined)
				return textarea.attr('disabled') === undefined;
			else {
				flag ? textarea.removeAttr('disabled') : textarea.attr('disabled', '');
				return This;
			}
		};
		this.readOnly = function(flag) {
			if (flag === undefined)
				return textarea.attr('readonly') !== undefined;
			else {
				flag ? textarea.attr('readonly', '') : textarea.removeAttr('readonly');
				flag ? textarea.parent().attr('readonly', '') : textarea.parent().removeAttr('readonly');
				return This;
			}
		};
		this.on = function(evname, handler) {
			events[evname] = handler;
			return This;
		};
		this.query = this.value = this.text = function(str) {
			if (str === undefined) 
				return textarea.val();
			else {
				textarea.val(str);
				return This;
			}
		};
		this.label = function(lbl) {
			if (lbl === undefined)
				return label;
			else {
				label = $(lbl);
				return This;
			}
		};
		this.show = function(fade) {
			textarea.show(fade);
			if (label) label.show(fade);
			return This;
		};
		this.hide = function(fade) {
			textarea.hide(fade);
			if (label) label.hide(fade);
			return This;
		};
		this.focus = function() {
			textarea.focus();
			return This;
		};
		this.placeholder = function(p) {
			if (p === undefined)
				return textarea.attr('placeholder');
			else {
				textarea.attr('placeholder', p);
				return This;
			}
		};
		return This;
	},

	Gauge: function(parent, scale) {
		var This = this;
		var scale = scale || 100;
		var level = 0;
		var events = {};

		var percentage = function(x) {
			if (x > scale)
				return '100%';
			if (x < 0)
				return '0%';
			return Math.round(100*x/scale) + '%';
		};
		
		var bar = $('<div>')
			.appendTo($(parent).attr('dy-role', 'gauge'))
			.attr('dy-role', 'gauge-bar')
			.css({width: percentage(level)});
			
		var reading = $('<div>')
			.appendTo($(parent))
			.attr('dy-role', 'gauge-reading')
			.html(percentage(level));
			
		var update = function() {
			bar.css('width', percentage(level));
			reading.html(percentage(level));
		};
		
		this.$ = function() {
			return $(parent);
		};
		this.scale = function(s) {
			if (s === undefined)
				return scale;
			else {
				scale = s || 100;
				update();
				return This;
			}
		};
		this.value = function(l) {
			return level;
		};
		this.on = function(evname, handler) {
			events[evname] = handler;
			return This;
		};
		this.level = function(l) {
			if (l === undefined) 
				return level;
			else if (typeof l == 'string') {
				bar.removeAttr('style').attr('standby', '');
				reading.html(l);
			} else if (l < 0) 
				bar.removeAttr('style').attr('standby', '');
			else {
				bar.removeAttr('standby');
				level = l;
				update();
			}
			return This;
		};
		this.text = function(t) {
			if (t === undefined)
				return reading.html();
			else {
				reading.html(t);
				return This;
			}
		};
		this.show = function(fade) {
			bar.show(fade);
			return This;
		};
		this.hide = function(fade) {
			bar.hide(fade);
			return This;
		};
		return This;
	},

	Checkbox: function(parent, text, defaultChecked) {
		if ($(parent).data('dollyCtrl'))
			return $(parent).data('dollyCtrl');
		var This = this;
		var events = {};
		var enabled = true;
		var box = $('<div>').addClass('dy-skin');
		var label = $('<span>').html(text || $(parent).attr('dy-label'));
		var checkbox = $(parent)
			.attr('dy-role', 'checkbox')
			.attr('dy-input', '')
			.on('click', function() {
				if (!enabled) return;
				if ($(parent).attr('readonly') !== undefined) {console.log('sorry, readonly'); return;}
				var checked = !(checkbox.attr('value').toString() == 'true');
				set(checked);
				if (events['click'])
					events['click'](checked, This);
			})
			.append(box, label)
			.data('dollyCtrl', This);
		
		var set = function(flag) {
			checkbox.attr('value', flag ? 'true' : 'false');
		};

		set(defaultChecked === undefined ? checkbox.attr('value') : defaultChecked);
		if (label.html()) label.show();

		this.$ = this.element = function() {
			return checkbox;
		};
		this.on = function(evname, handler) {
			events[evname] = handler;
			return This;
		};
		this.value = function() {
			return checkbox.attr('value') == 'true';
		};
		this.label = function(lbl) {
			if (lbl === undefined)
				return label;
			else {
				label = $(lbl);
				return This;
			}
		};
/*		this.label = function(str) {
			if (str === undefined) 
				return label.html();
			else {
				label.html(str).show();
				return This;
			}
		};	*/
		this.text = function(str) {
			if (str === undefined) 
				return label.html();
			else {
				label.html(str).show();
				return This;
			}
		};	
		this.checked = function(flag) {
			if (flag === undefined)
				return checkbox.attr('value') == 'true';
			else {
				set(flag);
				return This;
			}
		};
		this.readOnly = function(flag) {
			if (flag === undefined)
				return checkbox.attr('readonly') !== undefined;
			else {
				flag ? checkbox.attr('readonly', '') : checkbox.removeAttr('readonly');
				return This;
			}
		};
		this.set = function() {};
		this.clear = function() {
			set(defaultChecked === undefined ? false : defaultChecked);
			return This;
		};
		this.query = function() {
			return This.checked() ? 1 : 0;
		};
		return This;
	},
	
	SegmentedButton: function(parent) {
		var This = this;
		var optionsArray = [];
		var selectedIndex = -1;
		var events = {};

		var segmented = $(parent)
			.attr('dy-role', 'segmented-button')
			.html('')
			.data('dollyCtrl', This);
			
		var frame = $('<div>')
			.attr('dy-role', 'segmented-button-frame')
			.appendTo(segmented);
			
		var chosen = function(index, quiet) {
			return function() {
				//if (!This.enabled()) return;
				selectedIndex = index;
				segmented.children().removeAttr('selected');
				segmented.children('[index="' + index + '"]').attr('selected', '');
				var value = index >= 0 ? optionsArray[index].key : undefined;
				segmented.attr('value', value);
				frame.css('left', index*.1*Math.round(1000/optionsArray.length) + '%');
				if (!quiet && events['change'])
					events['change'](value, This);
				if (!quiet && events['_change_'])
					events['_change_'](value, This);
			}
		};

		this.enabled = function(flag) {
			if (flag === undefined)
				return segmented.attr('dy-disabled') === undefined;
			else {
				flag ? segmented.removeAttr('dy-disabled') : segmented.attr('dy-disabled', '');
				return This;
			}
		};
		this.value = function() {
			return 0 <= selectedIndex && selectedIndex < optionsArray.length ? optionsArray[selectedIndex].key : undefined;
		};
		this.options = function(array) {
			if (array === undefined)
				return optionsArray;
			else {
				var value = segmented.attr('value');
				optionsArray = array;
				segmented.children('[dy-role=segmented-button-item]').remove();
				frame.css('width', .1*Math.round(1000/array.length) + '%');
				for (var i in array) {
					var button = $('<div>')
						.attr('index', i)
						.attr('dy-role', 'segmented-button-item')
						.attr('title', array[i].title || '')
						.css({
							width: .1*Math.round(1000/array.length) + '%',
							height: '100%',
							backgroundImage: 'url(' + array[i].img + ')',
						})
						.on('click', chosen(i))
						.appendTo(segmented);
					if (value) {
						if (array[i].key == value)
							chosen(i)();
					} else if (array[i].selected)
						chosen(i)();
				}
				return This;
			}
		};

		return This;
	},

	Radio: function(parent) {
		var This = this;
		var optionsArray = [];
		var selectedIndex = -1;
		var label = null;
		var events = {};

		var radio = $(parent)
			.attr('dy-role', 'radio')
			.attr('dy-mode', 'column')
			.html('')
			.css('position', 'relative')
			.data('dollyCtrl', This);
			
		var chosen = function(index, quiet) {
			return function() {
				if (!This.enabled()) return;
				radio.find('[dy-role=radio-item]').removeAttr('selected');
				radio.find('[dy-role=radio-item][index="' + index + '"]').attr('selected', '');
				selectedIndex = index;
				radio.removeAttr('value');
				let value = undefined;
				if (index >= 0) {
					radio.attr('value', value); 
					value = optionsArray[index].key;
				}
				if (!quiet && events['change'])
					events['change'](value, This);
				if (!quiet && events['_change_'])
					events['_change_'](value, This);
			}
		};

		this.enabled = function(flag) {
			if (flag === undefined)
				return radio.attr('dy-disabled') === undefined;
			else {
				flag ? radio.removeAttr('dy-disabled') : radio.attr('dy-disabled', '');
				return This;
			}
		};
		this.mode = function(m) {
			if (m === undefined)
				return radio.attr('dy-mode'); 
			else {
				if (m == 'column' || m == 'row')
					radio.attr('dy-mode', m);
				return This;
			}
		};
		this.query = this.value = function() {
			return 0 <= selectedIndex && selectedIndex < optionsArray.length ? optionsArray[selectedIndex].key : undefined;
		};
		this.text = function(key, txt) {
			if (key === undefined) 
				key = This.value();
			var current = This.getOption(key);
			if (txt === undefined)
				return current ? current.value : undefined;
			else {
				if (current) current.value = txt;
				return This;
			}
		};
		this.options = function(array) {
			if (array === undefined)
				return optionsArray;
			else {
				var value = radio.attr('value');
				optionsArray = array;
				radio.children().remove();
				for (var i in array) {
					var radioItem = $('<div>')
						.attr('index', i)
						.attr('dy-role', 'radio-item')
						.attr('title', array[i].value)
						.on('click', chosen(i));
					$('<div>')
						.attr('dy-role', 'radio-item-button')
						.attr('dy-input', '')
						.attr('dy-disabled', array[i].disabled ? 'true' : 'false')
						.addClass('dy-skin')
						.appendTo(radioItem);
					$('<div>')
						.attr('dy-role', 'radio-item-label')
						.html(array[i].value)
						.appendTo(radioItem);
					radio.append(radioItem);
					if (value) {
						if (array[i].key == value)
							chosen(i)();
					} else if (array[i].selected)
						chosen(i)();
				}
				return This;
			}
		};
		this.addOptions = function(array) { // deprecated
			var value = radio.attr('value');
			optionsArray = array;
			radio.children().remove();
			for (var i in array) {
				var radioItem = $('<div>')
					.attr('index', i)
					.attr('dy-role', 'radio-item')
					.attr('title', array[i].value)
					.on('click', chosen(i));
				$('<div>')
					.attr('dy-role', 'radio-item-button')
					.attr('dy-input', '')
					.attr('dy-disabled', array[i].disabled ? 'true' : 'false')
					.addClass('dy-skin')
					.appendTo(radioItem);
				$('<div>')
					.attr('dy-role', 'radio-item-label')
					.html(array[i].value)
					.appendTo(radioItem);
				radio.append(radioItem);
				if (value) {
					if (array[i].key == value)
						chosen(i)();
				} else if (array[i].selected)
					chosen(i)();
			}
			return This;
		};
		this.clear = function() {
			chosen(-1, true)();
			return This;
		};
		this.getOption = this.option = function(key) {
			if (key === undefined) key = This.value();
			return optionsArray.find(function(op) {return (op.key == key);});
		};
		this.label = function(lbl) {
			if (lbl === undefined)
				return label;
			else {
				label = $(lbl);
				return This;
			}
		};
		this.on = function(evname, handler) {
			events[evname] = handler;
			return This;
		};
		this.show = function(fade) {
			$(parent).show(fade);
			if (label) label.show(fade);
			return This;
		};
		this.hide = function(fade) {
			$(parent).hide(fade);
			if (label) label.hide(fade);
			return This;
		};
		return This;
	},

	Hidden: function(parent) {
		var This = this;
		
		this.clear = function() {
			$(parent).attr('value', '');
			return This;
		};
		this.value = this.query = function(data) {
			if (data === undefined)
				return $(parent).attr('value');
			else {
				$(parent).attr('value', data);
				return This;
			}
		};
	},
	
	Select: function(parent) {
		var This = this;
		var optionsArray = [];
		var label = null;
		var selectedIndex = -1;
		var events = {};

		var list = $('<select>')
			.addClass('dy-skin')
			.on('change', function(ev) {
				var key = $(this).val();
				selectedIndex = $(this).find('option[value=' + key + ']').attr('index');
				$(parent).attr('value', key);
				if (events['change'])
					events['change'](key, This);
				$(this).blur();
			});

		$(parent)
			.html('')
			.attr('dy-role', 'select')
			.attr('dy-input', '')
			.append(list);

		this.on = function(evname, handler) {
			events[evname] = handler;
			return This;
		};

		this.options = function(array) {
			if (array === undefined)
				return optionsArray;
			else {
				var value = $(parent).attr('value');
				optionsArray = array;
				list.children().remove();
				selectedIndex = -1;
				for (var i in array) {
					var listItem = $('<option>')
						.attr('index', i)
						.attr('value', array[i].key)
						.html(array[i].value);
					if (array[i].disabled)
						listItem.attr('disabled', '');
					if (array[i].selected)
						listItem.attr('selected', '');
					list.append(listItem);
				}
				return This;
			}
		};

		this.value = function(key) {
			if (key === undefined)
				return 0 <= selectedIndex && selectedIndex < optionsArray.length ? optionsArray[selectedIndex].key : undefined;
			else {
				for (var i in optionsArray)
					if (optionsArray[i].key == key) { //console.log('found in:', i);
						list.val(key);
						break;
					}
				return This;
			}
		};
		
	},
	
	DropDown: function(parent) {
		var This = this;
		var optionsArray = [];
		var label = null;
		var selectedIndex = -1;
		var visibleListItems = 5;
		var events = {};
		var bullet = '●';
		var arrowStyle = function(H) {
			var h = .4*H, w = h, t = .5*(H - h);
			/*return {
				position: 'absolute', right: t + 'px', top: t + 'px', 
				borderWidth: h + 'px ' + (w/2) + 'px', borderStyle: 'solid', 
				borderColor: $(parent).css('color') + ' transparent transparent'
			};*/
			
			return {
				position: 'absolute',
				right: '0.5em',
				top: '0.3em',
				borderWidth: '0.8em 0.4em',
				borderStyle: 'solid',
				borderColor: $(parent).css('color') + ' transparent transparent'
			}
		};

		var list = $('<div>')
			.attr('dy-role', 'list')
			.addClass('dy-skin')
			.on('focusout', function() {
				list.hide();
			});
			//.css(styles.list);

		var loader = $('<div>').attr('dy-role', 'dropdown-loader').append($('<div>'));
		var selected = $('<div>');
		var selection = $('<div>')
			.attr('dy-role', 'selection')
			.addClass('dy-skin')
			.on('click', function() {
				if (!This.enabled()) return;
				if ($(parent).attr('readonly') !== undefined) return;
				list.toggle(); 
				var listHeight = list.prop('scrollHeight');
				var itemHeight = listHeight/list.children().length;
				list.css({maxHeight: (visibleListItems*itemHeight) + 'px'}).scrollTop(selectedIndex*itemHeight);
			});
		selection.append(selected);
		var arrow = $('<div>').css(arrowStyle($(parent).height())).attr('dy-role', 'droparrow');

		$(parent)
			.html('')
			.css('position', 'relative')
			.attr('dy-role', 'dropdown')
			.attr('dy-input', '')
			//.addClass('dy-skin-borderbottom')
			.append(loader, selection, arrow, list);
		
		var chosen = function(index, quiet) {
			return function(ev) { 
				if (ev) ev.stopPropagation();
				if (index >= 0) {
					selected.html(optionsArray[index].value);
					if (optionsArray[index].img)
						selected.prepend($('<img>').attr('src', optionsArray[index].img));
					if (optionsArray[index].bullet)
						selected.prepend($('<span>').html(bullet).css('color', optionsArray[index].bullet));
				} else
					selected.html('');
				list.children().eq(selectedIndex).removeAttr('selected');
				list.hide();
				selectedIndex = index;
				if (selectedIndex >= 0)
					list.children().eq(selectedIndex).attr('selected', '');
				var value = index >= 0 ? optionsArray[index].key : '';
				$(parent).attr('value', value);
				if (!quiet && events['change'])
					events['change'](value, This);
				if (!quiet && events['_change_'])
					events['_change_'](value, This);
			}
		};
		
		var getIndexFromKey = function(key) {
			for (var i in optionsArray)
				if (optionsArray[i].key == key)
					return i; 
			return -1;
		};
		
		this.id = function() {
			return $(parent).attr('id');
		};
		this.css = function(map) {
			selection.css(map)
			return This;
		};
		this.update = function() {
			arrow.css(arrowStyle($(parent).height()));
		};
		this.standby = function(flag) {
			if (flag === undefined)
				return loader.is(':visible');
			else {
				flag ? loader.show() : loader.hide();
				This.enabled(!flag);
				return This;
			}
		};
		this.enabled = function(flag) {
			if (flag === undefined)
				return $(parent).attr('dy-disabled') === undefined;
			else {
				flag ? $(parent).removeAttr('dy-disabled') : $(parent).attr('dy-disabled', '');
				return This;
			}
		};
		this.getKey = function() {
			return optionsArray[selectedIndex].key;
		};
		this.set = function(quiet) {
			var key = $(parent).attr('value'); //console.log('current value:', key, optionsArray);
			var index = -1
			for (var i in optionsArray)
				if (optionsArray[i].key == key) { //console.log('found in:', i);
					index = i;
					break;
				} //console.log('not found');
			chosen(index, quiet)();
			return This;
		};
		this.clear = function() {
			chosen(-1, true)();
			return This;
		};
		this.query = this.value = function(key, quiet) {
			if (key === undefined)
				return 0 <= selectedIndex && selectedIndex < optionsArray.length ? optionsArray[selectedIndex].key : undefined;
			else {
				for (var i in optionsArray)
					if (optionsArray[i].key == key) { //console.log('found in:', i);
						chosen(i, quiet)(); 
						break;
					}
				return This;
			}
		};
		this.bullet = function(char) {
			if (char === undefined)
				return bullet;
			else {
				bullet = char;
				return This;
			}
		};
		this.options = function(array) {
			if (array === undefined)
				return optionsArray;
			else {
				var value = $(parent).attr('value');
				optionsArray = array;
				list.children().remove();
				selectedIndex = -1;
				for (var i in array) {
					var option = array[i];
					var listItem = $('<div>')
						.attr('index', i)
						.attr('dy-role', option.group ? 'list-item-group' : 'list-item')
						.attr('dy-disabled', option.disabled ? 'true' : 'false')
						.html(option.value)
						.on('click', option.group || option.disabled ? null : chosen(i));
					if (option.separator)
						listItem.attr('dy-separator', '');
					if (option.title !== undefined)
						listItem.attr('title', option.title);
					if (option.img)
						listItem.prepend($('<img>').attr('src', option.img));
					if (option.bullet)
						listItem.prepend($('<span>').html(bullet).css('color', option.bullet));
					list.append(listItem);
					if (option.selected)
						chosen(i, true)();
					else if (value !== undefined) {
						if (!option.group && option.key == value)
							chosen(i, true)();
					}
				}
				This.update();
				return This;
			}
		};
		this.optionEnabled = function(key, flag) {
			var i = getIndexFromKey(key);
			var listItem = list.children('[index="' + i + '"]')
			if (flag === undefined)
				return listItem.attr('dy-disabled') === undefined;
			else {
				listItem.off('click');
				if (flag)
					listItem.removeAttr('dy-disabled').on('click', chosen(i));
				else
					listItem.attr('dy-disabled', '');
				return This;
			};
		};
		this.addOptions = function(array) { // Deprecated
			var value = $(parent).attr('value');
			optionsArray = array;
			list.children().remove();
			selectedIndex = -1;
			for (var i in array) {
				var listItem = $('<div>')
					.attr('index', i)
					.attr('dy-role', array[i].group ? 'list-item-group' : 'list-item')
					.attr('dy-disabled', array[i].disabled ? 'true' : 'false')
					.attr('title', array[i].value)
					.html(array[i].value)
					.on('click', array[i].group || array[i].disabled ? null : chosen(i));
				if (array[i].img)
					listItem.prepend($('<img>').attr('src', array[i].img));
				list.append(listItem);
				if (array[i].selected)
					chosen(i, true)();
				else if (value !== undefined) {
					if (!array[i].group && array[i].key == value)
						chosen(i, true)();
				}
			}
			This.update();
			return This;
		};
		this.readOnly = function(flag) {
			if (flag === undefined)
				return $(parent).attr('readonly') !== undefined;
			else {
				flag ? $(parent).attr('readonly', '') : $(parent).removeAttr('readonly');
				return This;
			}
		};
		this.populate = function(url, pars) {
			$.getJSON(url, function(response) {
				This.addOptions(pars(response));
			});
			return This;
		};
		this.getOption = this.option = function(key) {
			if (key === undefined) key = This.value();
			return optionsArray.find(function(op) {return (op.key == key);});
		};
		this.label = function(lbl) {
			if (lbl === undefined)
				return label;
			else {
				label = $(lbl);
				return This;
			}
		};
		this.on = function(evname, handler) {
			events[evname] = handler;
			return This;
		};
		this.show = function(fade) {
			$(parent).show(fade);
			if (label) label.show(fade);
			return This;
		};
		this.hide = function(fade) {
			$(parent).hide(fade);
			if (label) label.hide(fade);
			return This;
		};
		
		return This;
	},

	PopupMenu: function(parent, align) {
		var This = this;
		var optionsArray = [];
		var selectedIndex = -1;
		var visibleListItems = 5;
		var events = {};
		var sticky = true;
		var styles = {list: {}, listItem: {}, selected: {}};
		align = align || 'left';
		
		var list = $('<div>')
			.attr('dy-role', 'list')
			.attr(align, '')
			.on('focusout', function() {
				list.hide();
			});
			//.css(styles.list);

		$(parent)
			.css('position', 'relative')
			.attr('dy-role', 'popupmenu')
			.append(list)
			.on('click', function() {
				list.toggle();
				return false;
			});
		
		$('body').on('click', function() {list.hide();});
		
		var chosen = function(index, quiet) {
			return function(ev) { 
				if (ev) ev.stopPropagation();
				list.children().eq(selectedIndex).removeAttr('selected');
				list.hide();
				selectedIndex = index;
				if (sticky)
					list.children().eq(selectedIndex).attr('selected', '').css(styles.selected);
				if (!quiet && events['change'])
					events['change'](optionsArray[selectedIndex].key, This);
				if (!quiet && events['_change_'])
					events['_change_'](optionsArray[selectedIndex].key, This);
			}
		};
		
		this.id = function() {
			return $(parent).attr('id');
		};
		this.enabled = function(flag) {
			if (flag === undefined)
				return $(parent).attr('dy-disabled') === undefined;
			else {
				flag ? $(parent).removeAttr('dy-disabled') : $(parent).attr('dy-disabled', '');
				return This;
			}
		};
		this.sticky = function(flag) {
			if (flag === undefined)
				return sticky;
			else {
				sticky = !!flag;
				return This;
			}
		};
		this.style = function(listCSS, listitemCSS, selectedCSS) {
			list.css(listCSS).children().css(listitemCSS);
			list.children('[selected]').css(selectedCSS);
			styles.list = listCSS || styles.list;
			styles.listItem = listitemCSS || styles.listIte;
			styles.selected = selectedCSS || styles.selected;
			return This;
		};
		this.getKey = function() {
			return optionsArray[selectedIndex].key;
		};
		this.set = function() {
			var key = $(parent).attr('value'); //console.log('current value:', key, optionsArray);
			for (var i in optionsArray)
				if (optionsArray[i].key == key) { //console.log('found in:', i);
					chosen(i)(); 
					return This;
				} //console.log('not found');
			chosen(-1)();
			return This;
		};
		this.clear = function() {
			chosen(-1, true)();
			return This;
		};
		this.query = this.value = function() {
			return 0 <= selectedIndex && selectedIndex < optionsArray.length ? optionsArray[selectedIndex].key : undefined;
		};
		this.options = function(array) {
			if (array === undefined)
				return optionsArray;
			else {
				optionsArray = array;
				list.children().remove();
				selectedIndex = -1;
				for (var i in array) {
					var option = array[i];
					var listItem = $('<div>')
						.attr('index', i)
						.attr('dy-role', option.group ? 'list-item-group' : 'list-item')
						.attr('dy-disabled', option.disabled ? 'true' : 'false')
						.attr('title', option.title === undefined ? option.value : option.title)
						.html(option.value)
						.css(styles.listItem)
						.on('click', option.group || option.disabled ? null : chosen(i));
					if (option.separator)
						listItem.attr('dy-separator', '');
					if (option.img)
						listItem.prepend($('<img>').attr('src', option.img));
					if (option.class)
						listItem.addClass(option.class);
					list.append(listItem);
					if (option.selected)
						chosen(i, true)();
				}
				return This;
			}
		};
		/*this.addOptions = function(array) { // deprecated
			optionsArray = array;
			list.children().remove();
			selectedIndex = -1;
			for (var i in array) {
				var listItem = $('<div>')
					.css('height', $(parent).outerHeight() + 'px')
					.attr('index', i)
					.attr('dy-role', array[i].group ? 'list-item-group' : 'list-item')
					.attr('dy-disabled', array[i].disabled ? 'true' : 'false')
					.attr('title', array[i].value)
					.html(array[i].value)
					.on('click', array[i].group || array[i].disabled ? null : chosen(i));
				if (array[i].img)
					listItem.prepend($('<img>').attr('src', array[i].img));
				list.append(listItem);
				if (array[i].selected)
					chosen(i, true)();
			}
			return This;
		};*/
		this.populate = function(url, pars) {
			$.getJSON(url, function(response) {
				This.addOptions(pars(response));
			});
			return This;
		};
		/*this.getOption =*/ this.option = function(key) {
			if (key === undefined) key = This.value();
			return optionsArray.find(op => (op.key == key));
		};
		this.on = function(evname, handler) {
			events[evname] = handler;
			return This;
		};
		this.show = function() {
			$(parent).show(400);
			if (label) label.show(400);
			return This;
		};
		this.hide = function() {
			$(parent).hide(400);
			if (label) label.hide(400);
			return This;
		};
		
		return This;
	},

	Panel: function(parent) {
		var This = this;
		var events = {};
		var panels = [];
		
		var hideAll = function() {
			panels.forEach(function(panel) {
				panel.tab.removeAttr('selected');
				panel.page.hide();
			});
		};
		var show = function(panel) {
			return function() {
				hideAll();
				panel.tab.attr('selected', '');
				panel.page.show();
				if (events['select'])
					events['select'](panel);
			};
		};
		$(parent).children('[page]').each(function(ndx) {
			var tab = $(this);
			var page = $('#' + tab.attr('page'));
			var panel = {tab: tab, page: page, index: ndx};
			tab.on('click', show(panel));
			page.find('[dy-input]').data('dollyPanel', This).data('dollyReveal', show(panel));
			panels.push(panel);
		});
		
		this.select = function(index) {
			if (0 <= index && index < panels.length)
				show(panels[index])();
		};
		this.on = function(evname, handler) {
			events[evname] = handler;
			return This;
		};
	},
	
	Validator: function() {
		// Private:
		var This = this;
		var dtCh = '/',
			tmCh = ':',
			minYear = 1900,
			maxYear = 2100;
		// Holds last valid date analyzed
		var lastDate = null;
		var lastDateTime = null;
	
		var daysInFebruary = function(year) {
			// February has 29 days in any year evenly divisible by four,
			// EXCEPT for centurial years which are not also divisible by 400.
			return (((year % 4 == 0) && ( (!(year % 100 == 0)) || (year % 400 == 0))) ? 29 : 28 );
		};
		var daysInMonth = (function() {
			var d = [];
			for (var i = 1; i <= 12; i++) {
				d[i] = 31;
				if (i == 4 || i == 6 || i == 9 || i == 11) d[i] = 30;
				if (i == 2) d[i] = 29;
		   } 
		   return d;
		})();
		var stripCharsInBag = function(s, bag) {
			var i;
			var returnString = '';
			// Search through string's characters one by one.
			// If character is not in bag, append to returnString.
			for (i = 0; i < s.length; i++) {   
				var c = s.charAt(i);
				if (bag.indexOf(c) == -1)
					returnString += c;
			}
			return returnString;
		};

		this.isInteger = function(s) {
			var i;
			if (!s.length) return false;
			for (i = 0; i < s.length; i++) {   
				// Check that current character is number.
				var c = s.charAt(i);
				if (((c < '0') || (c > '9')))
					return false;
			}
			// All characters are numbers.
			return true;
		};
		this.isBoundedInteger = function(s, lower, upper) {
			if (this.isInteger(s)) {
				var n = parseInt(s, 10);
				return !(isNaN(n) || (n < lower) || (n > upper));
			} else
				return false;
		};
		this.isFloat = function(s) {
			var i, period = false;
			for (i = 0; i < s.length; i++) {   
				// Check that current character is integer or period.
				var c = s.charAt(i);
				if (!this.isInteger(c)) {
					if (period) 
						return false;
					else if (c == '.')
						period = true;
					else
						return false;
				}
			}
			// All characters are numbers or period.
			return true;
		};
		this.isDate = function(dtStr) {
			// Returns true if given string is a valid date in the format 'dd/mm/yyyy',
			// and place a valid Date object in lastDate
			var pos1 = dtStr.indexOf(dtCh);
			var pos2 = dtStr.indexOf(dtCh, pos1 + 1);
			var strDay = dtStr.substring(0, pos1);
			var strMonth = dtStr.substring(pos1 + 1, pos2);
			var strYear = dtStr.substring(pos2 + 1);
			strYr = strYear;
			if (strDay.charAt(0) == '0' && strDay.length > 1) strDay = strDay.substring(1);
			if (strMonth.charAt(0) == '0' && strMonth.length > 1) strMonth = strMonth.substring(1);
			for (var i = 1; i <= 3; i++) {
				if (strYr.charAt(0) == '0' && strYr.length > 1) 
					strYr = strYr.substring(1);
			}
			day = parseInt(strDay);
			month = parseInt(strMonth);
			year = parseInt(strYr);
			if (pos1 == -1 || pos2 == -1) {
				lastDate = null;
				return false;
			}
			if (strMonth.length < 1 || month < 1 || month > 12) {
				lastDate = null;
				return false;
			}
			if (strDay.length < 1 || day < 1 || day > 31 || (month == 2 && day > daysInFebruary(year)) || day > daysInMonth[month]) {
				lastDate = null;
				return false;
			}
			if (strYear.length != 4 || year == 0 || year < minYear || year > maxYear) {
				lastDate = null;
				return false;
			}
			if (dtStr.indexOf(dtCh, pos2 + 1) != -1 || This.isInteger(stripCharsInBag(dtStr, dtCh)) == false) {
				lastDate = null;
				return false;
			}
			lastDate = new Date(year, month - 1, day);
			return true;
		};
		this.isTime = function(s) {
			var pos1 = s.indexOf(tmCh);
			var pos2 = s.indexOf(tmCh, pos1 + 1);
			var strHour, strMinute, strSecond;
			if (pos1 == -1) {
				//alert('The time format should be : hh:mm[:ss]')
				return false;
			}
			strHour = s.substring(0, pos1);
			if (pos2 == -1) {
				strMinute = s.substring(pos1 + 1);
				strSecond = '0';
			} else {
				strMinute = s.substring(pos1 + 1, pos2);
				strSecond = s.substring(pos2 + 1);
			}
			if (This.isInteger(strHour) && This.isInteger(strMinute) && This.isInteger(strSecond)) {
				var hour = parseInt(strHour);
				var minute = parseInt(strMinute);
				var second = parseInt(strSecond);
				if (hour < 0 || hour > 23) return false;
				if (minute < 0 || minute > 59) return false;
				if (second < 0 || second > 59) return false;
				if (lastDate) 
					lastDateTime = new Date(lastDate.getFullYear(), 
					 					 	lastDate.getMonth(), 
											lastDate.getDate(), 
											hour, minute, second, 0);
				return true;
			}
			return false;
		};
		this.isDateTime = function(s) {
			var pos = s.indexOf(' ');
			var strDate, strTime;
			if (pos == -1) {
				//alert('The date time format should be : dd/mm/yyyy hh:mm[:ss]')
				return false;
			}
			strDate = s.substring(0, pos);
			strTime = s.substring(pos + 1);
			//return (this.isDate(strDate) && this.isTime(strTime));
			return This.isDate(strDate) ? This.isTime(strTime) : false;
		};
		this.setDateSeparator = function(c) {
			dtCh = c;
			return This;
		};
		this.lastDate = function() {
			return lastDate;
		};
	}

};
dolly.QueryData = dolly.Parameters;
