'use babel';

const fs = require('fs');
const path = require('path');

const doDebug = false;

export const debug = (obj) => {
  if (doDebug) console.log(obj);
};

export const toTemplatesDirectoryPath = (projectRootPath) =>
  path.join(projectRootPath, '.tempula');

export const forceLoadTemplates = (templatesDirectoryPath) => {
  try {
    fs.statSync(templatesDirectoryPath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      fs.mkdirSync(templatesDirectoryPath);
      fs.writeFileSync(
        path.join(templatesDirectoryPath, 'sample-template.html'),
        `@fileName@ created at @timestamp@`
      );
    }
  }

  const templateFileNames = fs.readdirSync(templatesDirectoryPath);
  return templateFileNames;
};

const caseConverters = (() => {
  const topTo = (str, caseFuncName) =>
    str.charAt(0)[caseFuncName]() + str.slice(1);
  const topToUpper = (str) => topTo(str, 'toUpperCase');
  const topToLower = (str) => topTo(str, 'toLowerCase');

  const camel = (str) =>
    topToLower(str).replace(/[-_](.)/g, (match, group1) =>
      group1.toUpperCase()
    );

  const separate = (str, symbol) =>
    camel(str).replace(/[A-Z]/g, (top) => symbol + top.charAt(0).toLowerCase());

  const snake = (str) => separate(str, '_');

  const kebab = (str) => separate(str, '-');

  const pascal = (str) => topToUpper(camel(str));

  return {
    kebab,
    snake,
    camel,
    pascal,
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
  replacingStr.match(replaceArg)
    ? replacingStr.replace(new RegExp(replaceArg, 'g'), replacement)
    : replacingStr;

const replaceWhenMatchFileName = (
  replacingStr,
  outputFileNameNoExt,
  caseName
) =>
  replaceWhenMatch(
    replacingStr,
    replaceArgs.fileName[caseName],
    caseConverters[caseName](outputFileNameNoExt)
  );

const replaceTemplateArgs = (templateStr, outputFileNameNoExt) => {
  let replacingStr = templateStr;
  replacingStr = replaceWhenMatch(
    replacingStr,
    replaceArgs.timestamp,
    new Date().getTime()
  );
  Object.keys(replaceArgs.fileName).forEach((caseName) => {
    replacingStr = replaceWhenMatchFileName(
      replacingStr,
      outputFileNameNoExt,
      caseName
    );
  });
  return replacingStr;
};

export const createFile = (
  projectRootPath,
  templateFileName,
  outputDirectoryPath,
  outputFileName
) => {
  const templateFileNameSplitted = templateFileName.split('.');
  const ext = templateFileNameSplitted[templateFileNameSplitted.length - 1];
  const outputFileNameNoExt = outputFileName.replace(
    new RegExp(`\.${ext}$`),
    ''
  );
  const outputFilePath = path.join(
    outputDirectoryPath,
    `${outputFileNameNoExt}.${ext}`
  );

  try {
    fs.statSync(outputFilePath);
    return {
      outputFilePath,
      success: false,
      error: {
        exists: true,
      },
    };
  } catch (err) {
    if (err.code !== 'ENOENT')
      return {
        outputFilePath,
        success: false,
        exception: err,
      };
  }

  const templateFilePath = path.join(
    toTemplatesDirectoryPath(projectRootPath),
    templateFileName
  );
  const src = fs.readFileSync(templateFilePath, 'utf-8');
  debug('▼▼▼▼▼ replace before ▼▼▼▼▼');
  debug(src);
  const dst = replaceTemplateArgs(src, outputFileNameNoExt);
  debug('▼▼▼▼▼ replace after ▼▼▼▼▼');
  debug(dst);

  fs.writeFileSync(outputFilePath, dst);
  return {
    outputFilePath,
    success: true,
  };
};
