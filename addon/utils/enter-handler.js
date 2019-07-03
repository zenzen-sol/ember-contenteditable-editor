import EmberObject from '@ember/object';
import { reads, alias } from '@ember/object/computed';
import getRichNodeMatchingDomNode from './get-rich-node-matching-dom-node';
import {
  tagName,
  isDisplayedAsBlock,
  invisibleSpace,
  insertNodeBAfterNodeA,
  insertTextNodeWithSpace
} from './dom-helpers';
import HandlerResponse from './handler-response';
import { debug } from '@ember/debug';
import { isBlank } from '@ember/utils';

/**
 * Enter Handler, a event handler to handle the generic enter case
 *
 * @module contenteditable-editor
 * @class EnterHandler
 * @constructor
 * @extends EmberObject
 */
export default EmberObject.extend({
  currentNode: alias('rawEditor.currentNode'),
  currentSelection: reads('rawEditor.currentSelection'),
  richNode: reads('rawEditor.richNode'),
  rootNode: reads('rawEditor.rootNode'),
  /**
   * tests this handler can handle the specified event
   * @method isHandlerFor
   * @param {DOMEvent} event
   * @return boolean
   * @public
   */
  isHandlerFor(event) {
    return event.type === "keydown" && event.key === "Enter" && this.get('rawEditor.currentSelectionIsACursor');
  },

  /**
   * handle the event
   * @method handleEvent
   * @param {DOMEvent} event
   * @return {HandlerResponse} response
   */
  handleEvent() {
    let currentNode = this.currentNode;
    let node = getRichNodeMatchingDomNode(currentNode, this.richNode);
    let currentPosition = this.currentSelection[0];
    let nodeForEnter = this.relevantNodeForEnter(node);
    let newCurrentNode;
    if (tagName(nodeForEnter.domNode) === "li") {
      debug('enter in li');
      this.rawEditor.externalDomUpdate(
        'inserting enter in li',
        () => this.insertEnterInLi(node, nodeForEnter, currentPosition, currentNode)
      );
      return HandlerResponse.create({allowPropagation: false});
    }
    else {
      if (currentNode.nodeType === Node.TEXT_NODE) {
        let insertBr = () => {
          debug('placing br');
          let splitAt = currentPosition - node.start;
          let above = document.createTextNode(currentNode.textContent.slice(0,splitAt));
          let content = currentNode.textContent.slice(splitAt);
          if (isBlank(content))
            content = invisibleSpace;
          let below = document.createTextNode(content);
          let br = document.createElement('br');
          currentNode.parentNode.insertBefore(above, currentNode);
          currentNode.parentNode.insertBefore(br, currentNode);
          currentNode.parentNode.insertBefore(below, currentNode);
          currentNode.parentNode.removeChild(currentNode);
          newCurrentNode = below;
        };
        this.rawEditor.externalDomUpdate('inserting enter in text', insertBr);
      }
      else {
        debug('-------------- not handling this enter yet------------------');
        return HandlerResponse.create({allowPropagation: true, allowBrowserDefault: true});
      }
      this.rawEditor.updateRichNode();
      this.rawEditor.setCarret(newCurrentNode, 0);
      return HandlerResponse.create({allowPropagation: false});
    }
  },

  /**
   * @method relevantNodeForEnter
   * @param {RichNode} richnode
   * @private
   */
  relevantNodeForEnter(node) {
    while(! isDisplayedAsBlock(node.domNode) && ! this.rootNode.isSameNode(node.domNode)) {
      node = node.parent;
    }
    return node;
  },

  /**
   * @method lisIsEmpty
   * @param {RichNode} node
   * @private
   */
  liIsEmpty(node) {
    let re = new RegExp(invisibleSpace,"g");
    return isBlank(node.domNode.textContent.replace(re, ''));
  },

  /**
   * @method insertEnterInLi
   * @param {RichNode} node
   * @param {RichNode} nodeForEnter
   * @param {number} currentPosition
   * @param {DOMNode} currentNode
   * @private
   */
  insertEnterInLi(node, nodeForEnter, currentPosition/*, currentNode*/) {
    // it's an li
    let ulOrOl = nodeForEnter.parent;
    let domNode = ulOrOl.domNode;
    let liDomNode = nodeForEnter.domNode;
    let textNode;
    const newElement = document.createElement('li');
    textNode = insertTextNodeWithSpace(newElement);
    if (! this.liIsEmpty(nodeForEnter) && (currentPosition === nodeForEnter.start)) {
      // insert li before li
      domNode.insertBefore(newElement,liDomNode);
    }
    else {
      // insert li after li
      insertNodeBAfterNodeA(domNode, liDomNode, newElement);
    }
    if (node.type ==='text' && nodeForEnter.children.includes(node)) {
      // the text node is a direct child of the li, we can split this
      const index = currentPosition - node.start;
      const text = node.domNode.textContent;
      if (currentPosition >= node.start && currentPosition <= node.end && currentPosition !== nodeForEnter.start) {
        // cursor not at start of the li, so just move everything after the cursor to the next node
        // if it is at the start an li was already inserted before it and we don't have to do anything
        node.domNode.textContent = text.slice(0,index);
        textNode.textContent = text.slice(index);
        while (node.domNode.nextSibling) {
          textNode.parentNode.append(node.domNode.nextSibling);
        }
      }
    }
    this.rawEditor.updateRichNode();
    this.rawEditor.setCarret(textNode, 0);
  }
});
