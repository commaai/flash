// Global XML parser utility object
window.XMLParserUtils = (function() {
    class Parser {
        constructor() {
            this.parser = new DOMParser();
        }

        parse(xmlString) {
            try {
                const doc = this.parser.parseFromString(xmlString, 'text/xml');
                if (doc.documentElement.nodeName === 'parsererror') {
                    console.error('XML Parse Error:', doc.documentElement.textContent);
                    return null;
                }
                return this.nodeToObject(doc.documentElement);
            } catch (error) {
                console.error('XML Parse Error:', error);
                return null;
            }
        }

        nodeToObject(node) {
            const obj = {
                tag: node.nodeName,
                attributes: {},
                children: []
            };

            // Get attributes
            Array.from(node.attributes || []).forEach(attr => {
                obj.attributes[attr.name] = attr.value;
            });

            // Get child nodes
            Array.from(node.childNodes).forEach(child => {
                if (child.nodeType === Node.ELEMENT_NODE) {
                    obj.children.push(this.nodeToObject(child));
                } else if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
                    obj.text = child.textContent.trim();
                }
            });

            return obj;
        }

        findTag(obj, tagName) {
            if (obj.tag.toLowerCase() === tagName.toLowerCase()) {
                return obj;
            }

            for (const child of obj.children) {
                const found = this.findTag(child, tagName);
                if (found) return found;
            }

            return null;
        }

        getAttribute(obj, attrName) {
            return obj.attributes[attrName];
        }

        getText(obj) {
            return obj.text || '';
        }

        hasAttribute(obj, attrName) {
            return attrName in obj.attributes;
        }

        getAttributeNames(obj) {
            return Object.keys(obj.attributes);
        }

        getChildren(obj) {
            return obj.children;
        }
    }

    // Public API
    return {
        Parser: Parser
    };
})();
