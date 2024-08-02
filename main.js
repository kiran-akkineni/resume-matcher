const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { exec } = require('child_process');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false,
        }
    });

    mainWindow.loadURL('http://localhost:3000');
}

app.on('ready', () => {
    createWindow();
    const server = require('./server');
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

ipcMain.handle('select-directory', async (event) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    return result.filePaths[0];
});
