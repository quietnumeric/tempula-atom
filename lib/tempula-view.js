'use babel';
const fs = require('fs');
const path = require('path');
import { CompositeDisposable } from 'atom';
import debug from './debug';

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

const toTempulaOutputDirectoryPath = projectRootPath => path.join(projectRootPath, '.tempula');

const caseConverters = (() => {

  const topTo = (str, caseFuncName) => str.charAt(0)[caseFuncName]() + str.slice(1);
  const topToUpper = str => topTo(str, 'toUpperCase');
  const topToLower = str => topTo(str, 'toLowerCase');

  const camel = str => topToLower(str).replace(/[-_](.)/g, (match, group1) => group1.toUpperCase());

  const separate = (str, symbol) => camel(str).replace(/[A-Z]/g, top => symbol + top.charAt(0).toLowerCase());

  const snake = str => separate(str, '_');

  const kebab = str => separate(str, '-');

  const pascal = str => topToUpper(camel(str));

  return {
    kebab, snake, camel, pascal,
  };
})();

const replaceArgs = {
  timestamp: '@timestamp@',
  fileName: {
    kebab: '@file-name@',
    snake: '@file_name@',
    camel: '@fileName@',
    pascal: '@FileName@',
  },
};

const replaceWhenMatch = (replacingStr, replaceArg, replacement) =>
  replacingStr.match(replaceArg) ? replacingStr.replace(new RegExp(replaceArg, 'g'), replacement) : replacingStr;

const replaceWhenMatchFileName = (replacingStr, outputFileNameNoExt, caseName) =>
  replaceWhenMatch(
    replacingStr,
    replaceArgs.fileName[caseName],
    caseConverters[caseName](outputFileNameNoExt)
  );

const replaceTemplateArgs = (templateStr, outputFileNameNoExt) => {
  let replacingStr = templateStr;
  replacingStr = replaceWhenMatch(replacingStr, replaceArgs.timestamp, new Date().getTime());
  Object.keys(replaceArgs.fileName).forEach((caseName) => {
    replacingStr = replaceWhenMatchFileName(replacingStr, outputFileNameNoExt, caseName);
  });
  return replacingStr;
};

const toPathBelowRoot = (projectRootPath, fullPath) => fullPath.replace(projectRootPath, '').replace(/^\//, '');

const createFile = (message, projectRootPath, templateFileName, outputDirectoryPath, outputFileName) => {
  message.failure('Empty.');
  const templateFileNameSplitted = templateFileName.split('.');
  const ext = templateFileNameSplitted[templateFileNameSplitted.length - 1];
  const outputFileNameNoExt = outputFileName.replace(new RegExp(`\.${ext}$`), '');
  const outputFilePath = path.join(outputDirectoryPath, `${outputFileNameNoExt}.${ext}`);

  try {
    fs.statSync(outputFilePath);
    message.failure(`Already exists. - ${outputFilePath}`);
    return;
  } catch(err) {
    if (err.code !== 'ENOENT') throw err;
  }

  const templateFilePath = path.join(toTempulaOutputDirectoryPath(projectRootPath), templateFileName);
  fs.readFile(templateFilePath, 'utf-8', (readError, src) => {
    if (readError) throw readError;
    debug('▼▼▼▼▼ replace before ▼▼▼▼▼');
    debug(src);
    const dst = replaceTemplateArgs(src, outputFileNameNoExt);
    debug('▼▼▼▼▼ replace after ▼▼▼▼▼');
    debug(dst);

    fs.writeFile(outputFilePath, dst, function (writeError) {
      if (writeError) throw writeError;
      message.success(`Created - ${toPathBelowRoot(projectRootPath, outputFilePath)}`);
    });
  });
};

const replaceList = (message, input, editor, listElement, projectRootPath, outputDirectoryPath, fileNames) => {
  Array.from(listElement.children).forEach((child) => {
    listElement.removeChild(child);
  });
  fileNames.forEach((fileName) => {
    const li = document.createElement('li');
    li.textContent = fileName;
    listElement.appendChild(li);
    li.addEventListener('click', () => {
      createFile(message, projectRootPath, fileName, outputDirectoryPath, editor.getText());
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

    const tempulaOutputDirectoryPath = toTempulaOutputDirectoryPath(this.projectRootPath)
    try {
      fs.statSync(tempulaOutputDirectoryPath);
    } catch(err) {
      if(err.code === 'ENOENT') {
        fs.mkdirSync(tempulaOutputDirectoryPath);
        fs.writeFileSync(path.join(tempulaOutputDirectoryPath, 'sample-template.html'), `@fileName@ created at @timestamp@`)
      }
    }

    const templateFileNames = fs.readdirSync(tempulaOutputDirectoryPath);
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
