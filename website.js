FList.BBParser = function() {
	let _Utils               = {
		    _urlregex:   /^\s*((?:https?|ftps?|irc):\/\/[^\s/$.?#"'].[^\s]*)\s*$/,
		    validateURL: function(b) {return _Utils._urlregex.test(b)},
		    unescapeURL: function(escaped) {
			    escaped.replace(/"/g, '&quot;')
			    escaped.replace(/'/g, '&#39;')
			    escaped.replace(/</g, '&lt;')
			    escaped.replace(/>/g, '&gt;')

			    let div = document.createElement('div')
			    div.innerHTML = escaped

			    return div.textContent
		    }
	    },
	    tags                 = {
		    noparse: {
			    render:  function(content) {
				    return content
			    },
			    allowed: false
		    },
		    b:       {
			    htmlPrefix: 'strong',
			    htmlSuffix: 'strong',
			    allowed:    true
		    },
		    i:       {
			    htmlPrefix: 'em',
			    htmlSuffix: 'em',
			    allowed:    true
		    },
		    u:       {
			    htmlPrefix: 'span style="text-decoration:underline;"',
			    htmlSuffix: 'span',
			    allowed:    true
		    },
		    s:       {
			    htmlPrefix: 'del',
			    htmlSuffix: 'del',
			    allowed:    true
		    },
		    sub:     {
			    htmlPrefix: 'sub',
			    htmlSuffix: 'sub',
			    allowed:    ['b', 'i', 'u']
		    },
		    sup:     {
			    htmlPrefix: 'sup',
			    htmlSuffix: 'sup',
			    allowed:    ['b', 'i', 'u']
		    },
		    url:     {
			    render:  function(content, attribute) {
				    if (content.length === 0) {
					    content = attribute
					    attribute = undefined
				    }

				    if (typeof attribute !== 'undefined') {
					    attribute = attribute.replace(/ /g, '%20')

					    if (_Utils.validateURL(attribute) && !_Utils.validateURL(content)) {
						    let components = _Utils._urlregex.exec(attribute),
						        hostname   = components[1].match(/(https?|ftps?|irc):\/\/(?:www.)?([^\/]+)/)[2],
						        div        = document.createElement('div'),
						        linkElem   = document.createElement('a')

						    linkElem.href = _Utils.unescapeURL(components[1])
						    linkElem.className = 'ParsedLink ImageLink'
						    linkElem.target = '_blank'
						    linkElem.rel = 'nofollow noreferrer noopener'
						    linkElem.textContent = content.replace(/&amp;/g, '&')
						    div.appendChild(linkElem)

						    return `${div.innerHTML} <span style="font-size: 0.8em;">[${hostname}]</span>`
					    }

					    return `[bad url: ${attribute}] ${content}`
				    }

				    if (_Utils.validateURL(content)) {
					    let components = _Utils._urlregex.exec(content),
					        div        = document.createElement('div'),
					        linkElem   = document.createElement('a')

					    linkElem.href = _Utils.unescapeURL(components[1])
					    linkElem.className = 'ParsedLink ImageLink'
					    linkElem.target = '_blank'
					    linkElem.rel = 'nofollow noreferrer noopener'
					    linkElem.textContent = components[1].replace(/&amp;/g, '&')
					    div.appendChild(linkElem)

					    return div.innerHTML
				    } else {
					    return `[bad url: ${content}] `
				    }
			    },
			    allowed: false
		    },
		    color:   {
			    render:  function(content, attribute) {
				    return `<span style="color:${attribute};">${content}</span>`
			    },
			    allowed: true
		    }
	    },
	    currentText          = null,
	    currentAST           = null,
	    warningsEnabled      = false,
	    warnings             = null,
	    bbcodeRegex          = /(\[[\[ \/]*)([^\[\]]+)([\] ]*])/,
	    replaceLongWords     = false,
	    replaceLongWordsWith = 'Text cut: too long.',
	    arrContains          = function(needle, haystack) {
		    for (let c = 0; c < haystack.length; c++) {
			    if (haystack[c] === needle) {
				    return true
			    }
		    }

		    return false
	    },
	    newAllowed           = function(outerAllowed, tagName) {
		    if (!tags[tagName]) return true
		    let innerAllowable = tags[tagName].allowed

		    if (outerAllowed === true && innerAllowable === true) return true
		    if (typeof innerAllowable === 'undefined') return outerAllowed
		    if (outerAllowed === false) return false

		    let innerAllowed = []

		    for (let i = 0; i < innerAllowable.length; i++) {
			    if (outerAllowed === true || arrContains(outerAllowed, innerAllowable[i])) {
				    innerAllowed.push(innerAllowable[i])
			    }
		    }

		    return innerAllowed.length === 0
		           ? false
		           : innerAllowed
	    },
	    parseAST             = function(astElem, outerAllowed, innerAllowed) {
		    if (astElem instanceof Array) {
			    let text = ''

			    for (let i = 0; i < astElem.length; i++) {
				    text += parseAST(astElem[i], innerAllowed, newAllowed(innerAllowed, astElem[i].tagname))
			    }

			    return text
		    }

		    if (astElem.tagname === 'text') {
			    return replaceLongWords && /\w{50,}/.test(currentText.substring(astElem.start, astElem.end))
			           ? replaceLongWordsWith
			           : currentText.substring(astElem.start, astElem.end)
		    }

		    if (astElem.tagname && outerAllowed !== false && (
			    outerAllowed === true || arrContains(astElem.tagname, outerAllowed)
		    )) {
			    let p = tags[astElem.tagname]

			    if (!astElem.content) return ''

			    let content = parseAST(astElem.content, outerAllowed, innerAllowed)
			    return typeof p.render === 'function'
			           ? p.render(content, astElem.attribute)
			           : `<${p.htmlPrefix}>${content}</${p.htmlSuffix}>`
		    }

		    if (warningsEnabled && astElem.tagname) {
			    warnings.push('The [' + astElem.tagname + '] tag is not allowed here: ' +
			                  currentText.substr(astElem.start, 60) + '...')
		    }

		    return currentText.substring(astElem.start, astElem.end)
	    },
	    normalizeAST         = function(ast, startPos, endPos) {
		    for (let i = 0; i < ast.length; i++) {
			    if (ast[i].tagname === 'text') {
				    if (i === 0) {
					    ast[i].start = startPos
				    }

				    if (i === ast.length - 1) {
					    ast[i].end = endPos
				    }
			    }

			    if (i > 0 && ast[i - 1].tagname === 'text') {
				    ast[i - 1].end = ast[i].start
			    }
		    }
	    },
	    generateAST          = function(current, start, length, depth) {
		    if (current != null) {
			    let openend = current.openend

			    if (current.tagname === 'noparse') {
				    let l = '[/noparse]'

				    openend = currentText.substring(current.openend, length).indexOf(l)
				    openend = openend > -1
				              ? openend + (current.openend + 10)
				              : length

				    return {
					    tagname: 'noparse',
					    start:   current.openstart,
					    end:     openend,
					    content: [
						    {
							    tagname: 'text',
							    start:   current.openstart + 9,
							    end:     openend - 10
						    }
					    ]
				    }
			    }

			    let elem = {
				    tagname:   current.tagname,
				    attribute: current.attribute,
				    start:     current.openstart
			    }

			    let ast = generateAST(null, openend + 1, length, depth + 1)

			    let currentPos = ast[ast.length - 1].end
			    let endstart = currentText.substring(currentPos, length).indexOf('[/')

			    if (endstart > -1) {
				    endstart += currentPos
			    }

			    let endend = currentText.substring(endstart, length).indexOf(']')

			    if (endend > -1) {
				    endend += endstart
			    }

			    if (endstart > -1 && current.tagname === currentText.substring(endstart + 2, endend)) {
				    elem.end = endend + 1
				    elem.content = ast
			    } else {
				    if (warningsEnabled) {
					    if (currentText.substring(currentPos, length).indexOf('[/' + current.tagname) === -1) {
						    warnings.push(`Open [${current.tagname}] tag is not properly closed (with [/${current.tagname}]).`)
					    } else {
						    warnings.push(`Bad BBCode in [${current.tagname}] tag, somewhere around/after '${currentText.substr(openend + 1, 50)}...'.`)
					    }
				    }

				    elem.tagname = 'text'
				    elem.end = endstart === -1 || endend === -1
				               ? length
				               : endend + 1
			    }

			    normalizeAST(ast, openend + 1, endstart)
			    elem.content = ast

			    return elem
		    }

		    current = currentText.substring(start, length).indexOf('[')

		    if (current > -1) {
			    current += start
		    }

		    let openend = currentText.substring(current, length).indexOf(']')

		    if (openend > -1) {
			    openend += current
		    }

		    let tagName

		    if (current > -1 && openend > -1) {
			    let match = currentText.substring(current + 1, openend).match(/^([a-z]+)(?:=([^\]]+))?/i)

			    if (match != null) {
				    tagName = match[1].toLowerCase()

				    if (tags[tagName]) {
					    tagName = { tagname: tagName }

					    if (match[2]) {
						    tagName.attribute = match[2]
					    }
				    } else {
					    if (warningsEnabled) {
						    warnings.push(`This looks like a bbcode tag, but isn't one: [${tagName}]`)
					    }
				    }
			    } else {
				    tagName = null
			    }
		    } else {
			    return [
				    {
					    tagname: 'text',
					    start:   start,
					    end:     start
				    }
			    ]
		    }

		    if (tagName === null) {
			    return [
				    {
					    tagname: 'text',
					    start:   start,
					    end:     start
				    }
			    ]
		    }

		    let newAST = []

		    if (start < current) {
			    let currentAST = generateAST(null, start, current, depth + 1)

			    for (let i = 0; i < currentAST.length; i++) {
				    newAST.push(currentAST[i])
			    }
		    }

		    tagName.openstart = current
		    tagName.openend = openend

		    let elem = generateAST(tagName, openend, length, depth + 1)
		    newAST.push(elem)

		    if (elem.end < length) {
			    let rest = generateAST(null, elem.end, length, depth + 1)

			    for (let i = 0; i < rest.length; i++) {
				    newAST.push(rest[i])
			    }
		    }

		    return newAST
	    }

	return {
		Util:                 _Utils,
		parseBB:              function(input) {
			warnings = []

			let text = input.replace(/\[]/g, '&#91;&#93;')

			for (let pos = 0; ;) {
				let match = bbcodeRegex.exec(text.substr(pos))

				// noinspection JSValidateTypes
				if (match === null) break

				if (match[2].indexOf('=') !== -1) {
					match[2] = match[2].slice(0, match[2].indexOf('='))

					if (match[1] !== '[' && match[1] !== '[/' || match[3] !== ']' || !tags[match[2]]) {
						let tag = match[0].replace(/\[/g, '&#91;').replace(/]/g, '&#93;')
						pos = pos + match.index + tag.length
						text = text.slice(0, pos + match.index) + tag + text.slice(pos + match.index + match[0].length)
					} else {
						pos += match[0].length
					}
				} else {
					pos += match[0].length
				}
			}

			currentText = text
			currentAST = generateAST(null, 0, currentText.length, 0)
			normalizeAST(currentAST, 0, currentText.length)
			text = parseAST(currentAST, true, true)

			if (text.length === 0 && input.length > 0) {
				warnings.push('Toplevel tag structure errors found. Check your out-most tags.')
			}

			if (warningsEnabled && warnings.length > 0) {
				let x = '<div style="border: 2px solid yellow; padding: 3px; background: #600; color: white; margin-bottom: 1.5em;">Warning: The BBCode parser has found errors in your code.<ul style="margin-top: 0.5em; margin-bottom: 0.5em; padding-left: 1em; margin-left: 0.5em; list-style-type: square;">'
				for (let l in warnings) x += '<li>' + warnings[l].replace(/\n/g, '') + '</li>'
				text = x + '</ul></div>' + text
			}

			currentAST = currentText = null

			return text
		},
		parseEmotes:          function(text) {
			$.each(
				'hex-smile heart hex-yell hex-sad hex-grin hex-red hex-razz hex-twist hex-roll hex-mad hex-confuse hex-eek hex-wink lif-angry lif-blush lif-cry lif-evil lif-gasp lif-happy lif-meh lif-neutral lif-ooh lif-purr lif-roll lif-sad lif-sick lif-smile lif-whee lif-wink lif-wtf lif-yawn cake'.split(' '),
				function(_, emote) {
					text = text.replace(
						new RegExp(':' + emote + ':', 'gim'),
						`<img src='${staticdomain}images/smileys/${emote}.png' alt='${emote} emote' title=':${emote}:' align='middle'/>`
					)
				}
			)

			return text
		},
		parseContent:         function(text) {
			text = this.parseBB(text)

			if (/<br ?\/?>/.test(text) === false) {
				text = FList.Common_nl2br(text)
			}

			return this.parseEmotes(text)
		},
		addCustomTag:         function(name, allowed, rendr) {
			tags[name] = {
				render:  rendr,
				allowed: allowed
			}
		},
		addSimpleTag:         function(name, htmlPrefix, htmlSuffix, allowed) {
			tags[name] = {
				htmlPrefix: htmlPrefix,
				htmlSuffix: htmlSuffix,
				allowed:    allowed
			}
		},
		enableWarnings:       function(enableWarnings) {
			warningsEnabled = enableWarnings === undefined
			                  ? true
			                  : enableWarnings
		},
		addWarning:           function(warning) {
			if (warningsEnabled) {
				warnings.push(warning)
			}
		},
		replaceLongWordsWith: function(toReplaceLongWordsWith) {
			replaceLongWords = true
			replaceLongWordsWith = toReplaceLongWordsWith
		}
	}
}
