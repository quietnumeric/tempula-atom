'use babel';
const fs = require('fs');
const path = require('path');
import { CompositeDisposable } from 'atom';
import {
  debug,
  toTemplatesDirectoryPath,
  forceLoadTemplates,
  createFile,
} from './tempula-core';

const createMessageLabel = () => {
  const label = document.createElement('label');
  label.className = 'message';
  return label;
};

const createPathLabel = () => {
  const label = document.createElement('label');
  label.className = 'icon icon-file-add';
  return label;
};

const createInput = () => {
  const input = document.createElement('atom-text-editor');
  input.setAttribute('mini', '');
  const editor = atom.workspace.buildTextEditor();
  input.setModel(editor);
  return input;
}

const toPathBelowRoot = (projectRootPath, fullPath) => fullPath.replace(projectRootPath, '').replace(/^\//, '');

const replaceList = (message, input, editor, listElement, projectRootPath, outputDirectoryPath, fileNames) => {
  Array.from(listElement.children).forEach((child) => {
    listElement.removeChild(child);
  });
  fileNames.forEach((templateFileName) => {
    const li = document.createElement('li');
    li.textContent = templateFileName;
    listElement.appendChild(li);
    li.addEventListener('click', () => {
      const {
        outputFilePath,
        success,
        exception,
        error,
      } = createFile(projectRootPath, templateFileName, outputDirectoryPath, editor.getText());
      if (success) {
        message.success(`Created - ${toPathBelowRoot(projectRootPath, outputFilePath)}`);
        input.focus();
        return;
      }
      if (exception) {
        message.failure(`Exception ${exception} - ${outputFilePath}`);
      }
      if (error && error.exists) {
        message.failure(`Already exists. - ${outputFilePath}`);
      }
      input.focus();
    }, false);
  });
};

const messageClassNames = {
  success: 'success',
  failure: 'failure',
};

const Messsage = label => (() => {
  const core = (text, className) => {
    label.textContent = text;
    label.classList.remove(messageClassNames.success, messageClassNames.failure);
    if (className) label.classList.add(className);
  }

  return {
    init: text => core(text),
    success: text => core(text, messageClassNames.success),
    failure: text => core(text, messageClassNames.failure),
  }
})();

const setMessage = (label, type, text) => {
  label.textContent = text;
  label.classList.remove('success', 'failure');
};

export default class TempulaView {
  constructor(serializedState) {
    debug('view.instantiate');

    // Create root element
    this.element = document.createElement('div');
    this.element.classList.add('tempula');

    const messageLabel = createMessageLabel('Input file name and choose template.');
    this.messageLabel = messageLabel;
    this.element.appendChild(messageLabel);

    const pathLabel = createPathLabel();
    this.pathLabel = pathLabel;
    this.element.appendChild(pathLabel);

    const input = createInput();
    this.input = input;
    this.editor = input.getModel();
    this.element.appendChild(input);

    const list = document.createElement('ul');
    this.list = list;
    this.element.appendChild(list);
  }

  open(outputDirectoryPath) {
    debug('view.open');
    this.input.focus();
    this.outputDirectoryPath = outputDirectoryPath;
    this.projectRootPath = atom.project.getPaths()[0];

    const templatesDirectoryPath = toTemplatesDirectoryPath(this.projectRootPath)
    const templateFileNames = forceLoadTemplates(templatesDirectoryPath);
    const message = Messsage(this.messageLabel);
    replaceList(message, this.input, this.editor, this.list, this.projectRootPath, this.outputDirectoryPath, templateFileNames);
    message.init('Input file name (without .ext) and choose template.');
    this.pathLabel.textContent = toPathBelowRoot(this.projectRootPath, outputDirectoryPath) + '/';
  }

  // Returns an object that can be retrieved when package is activated
  serialize() {}

  // Tear down any state and detach
  destroy() {
    debug('view.destroy');
    // atom.workspace.getActivePane().activate()
    this.element.remove();
  }

  getElement() {
    return this.element;
  }
}
