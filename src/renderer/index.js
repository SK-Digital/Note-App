const { ipcRenderer } = require('electron');

let currentNote = null;
let notes = [];
let folders = [];
let currentFolder = null;
let editor;
let folderSelect;
let noteTitleInput;

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Quill
  editor = new Quill('#editor', {
    theme: 'snow',
    modules: {
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        ['blockquote', 'code-block'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['link', 'image'],
        ['clean']
      ]
    }
  });

  // Initialize folderSelect and noteTitleInput
  folderSelect = document.getElementById('folder-select');
  noteTitleInput = document.getElementById('note-title');

  // Add event listeners for buttons
  document.getElementById('new-folder').addEventListener('click', showNewFolderDialog);
  document.getElementById('new-note').addEventListener('click', createNewNote);
  document.getElementById('save-note').addEventListener('click', saveCurrentNote);
  document.getElementById('toggle-theme').addEventListener('click', toggleTheme);
  
  // New folder dialog event listeners
  document.getElementById('confirm-new-folder').addEventListener('click', confirmNewFolder);
  document.getElementById('cancel-new-folder').addEventListener('click', hideNewFolderDialog);

  // Load folders and notes on startup
  loadFoldersAndNotes();

  // Helper functions
  function showNewFolderDialog() {
    document.getElementById('new-folder-dialog').classList.remove('hidden');
  }

  function hideNewFolderDialog() {
    document.getElementById('new-folder-dialog').classList.add('hidden');
    document.getElementById('new-folder-name').value = '';
  }

  function confirmNewFolder() {
    const folderName = document.getElementById('new-folder-name').value.trim();
    if (folderName) {
      createNewFolder(folderName);
      hideNewFolderDialog();
    }
  }

  function createNewFolder(folderName) {
    const newFolder = {
      id: Date.now().toString(),
      name: folderName,
      notes: []
    };
    folders.push(newFolder);
    saveFolders();
    updateFolderList();
  }

  function createNewNote() {
    currentNote = {
      id: Date.now().toString(),
      title: 'Untitled Note',
      content: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      folderId: currentFolder ? currentFolder.id : null
    };
    editor.setText('');
    noteTitleInput.value = currentNote.title;
    folderSelect.value = currentNote.folderId || '';
    notes.push(currentNote);
    updateNoteList();
    showEditor();
    console.log('New note created:', currentNote);
  }

  async function saveCurrentNote() {
    if (!currentNote) return;

    currentNote.content = editor.root.innerHTML;
    currentNote.title = noteTitleInput.value;
    currentNote.updatedAt = new Date().toISOString();
    currentNote.folderId = folderSelect.value || null;

    try {
      await ipcRenderer.invoke('save-note', currentNote);
      console.log('Note saved successfully');
      loadFoldersAndNotes(); // Refresh the folder and note lists
    } catch (error) {
      console.error('Error saving note:', error);
    }
  }

  async function loadFoldersAndNotes() {
    try {
      folders = await ipcRenderer.invoke('load-folders');
      notes = await ipcRenderer.invoke('load-notes');
      updateFolderList();
      updateNoteList();
      showRecentNotes();
    } catch (error) {
      console.error('Error loading folders and notes:', error);
    }
  }

  function updateFolderList() {
    const folderList = document.getElementById('folder-list');
    folderList.innerHTML = '';
    folderSelect.innerHTML = '<option value="">No Folder</option>';
    folders.forEach(folder => {
      const folderElement = document.createElement('div');
      folderElement.className = 'py-2 px-4 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer rounded-md mb-2';
      folderElement.dataset.folderId = folder.id;
      folderElement.innerHTML = `
        <div class="flex justify-between items-center">
          <span><i class="fas fa-folder mr-2 text-alchemy-red"></i>${folder.name}</span>
          <div>
            <button class="text-blue-500 hover:text-blue-600 mr-2 rename-folder"><i class="fas fa-edit"></i></button>
            <button class="text-red-500 hover:text-red-600 delete-folder"><i class="fas fa-trash"></i></button>
          </div>
        </div>
        <div class="folder-notes ml-4 hidden"></div>
      `;
      folderElement.querySelector('.flex').addEventListener('click', () => toggleFolder(folder, folderElement));
      folderElement.querySelector('.rename-folder').addEventListener('click', (e) => {
        e.stopPropagation();
        startRenamingFolder(folder, folderElement.querySelector('span'));
      });
      folderElement.querySelector('.delete-folder').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteFolder(folder.id);
      });
      folderList.appendChild(folderElement);

      // Add folder to the select dropdown
      const option = document.createElement('option');
      option.value = folder.id;
      option.textContent = folder.name;
      folderSelect.appendChild(option);
    });
  }

  function toggleFolder(folder, folderElement) {
    const notesContainer = folderElement.querySelector('.folder-notes');
    if (notesContainer.classList.contains('hidden')) {
      notesContainer.classList.remove('hidden');
      updateFolderNotes(folder, notesContainer);
    } else {
      notesContainer.classList.add('hidden');
    }
  }

  function updateFolderNotes(folder) {
    if (!folder) return;
    
    const folderElement = document.querySelector(`[data-folder-id="${folder.id}"]`);
    if (folderElement) {
      const notesContainer = folderElement.querySelector('.folder-notes');
      updateFolderNotesContainer(folder, notesContainer);
    }
  }

  function updateFolderNotesContainer(folder, notesContainer) {
    notesContainer.innerHTML = '';
    const folderNotes = notes.filter(note => note.folderId === folder.id);
    folderNotes.forEach(note => {
      const noteElement = createNoteElement(note);
      notesContainer.appendChild(noteElement);
    });
  }

  function updateNoteList() {
    const noteList = document.getElementById('note-list');
    noteList.innerHTML = '';
    const unassignedNotes = notes.filter(note => !note.folderId);
    unassignedNotes.forEach(note => {
      const noteElement = createNoteElement(note);
      noteList.appendChild(noteElement);
    });
  }

  function createNoteElement(note) {
    const noteElement = document.createElement('div');
    noteElement.className = 'py-2 px-4 hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer flex justify-between items-center rounded-md my-1';
    noteElement.draggable = true;
    noteElement.dataset.noteId = note.id;
    
    const titleSpan = document.createElement('span');
    titleSpan.textContent = note.title;
    titleSpan.className = 'flex-grow';
    titleSpan.addEventListener('click', () => loadNote(note));
    noteElement.appendChild(titleSpan);

    const buttonsDiv = document.createElement('div');
    buttonsDiv.className = 'flex items-center';

    const renameButton = document.createElement('button');
    renameButton.innerHTML = '<i class="fas fa-edit"></i>';
    renameButton.className = 'text-blue-500 hover:text-blue-600 mr-2';
    renameButton.addEventListener('click', (e) => {
      e.stopPropagation();
      startRenaming(note, titleSpan, buttonsDiv);
    });
    buttonsDiv.appendChild(renameButton);

    const deleteButton = document.createElement('button');
    deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
    deleteButton.className = 'text-red-500 hover:text-red-600';
    deleteButton.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteNote(note.id);
    });
    buttonsDiv.appendChild(deleteButton);

    noteElement.appendChild(buttonsDiv);

    noteElement.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', note.id);
    });

    return noteElement;
  }

  function startRenaming(note, titleSpan, buttonsDiv) {
    const inputElement = document.createElement('input');
    inputElement.type = 'text';
    inputElement.value = note.title;
    inputElement.className = 'flex-grow mr-2 p-1 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-alchemy-red';

    const saveButton = document.createElement('button');
    saveButton.innerHTML = '<i class="fas fa-save"></i>';
    saveButton.className = 'text-green-500 hover:text-green-600 mr-2';
    saveButton.addEventListener('click', () => finishRenaming(note, inputElement, titleSpan, buttonsDiv));

    const cancelButton = document.createElement('button');
    cancelButton.innerHTML = '<i class="fas fa-times"></i>';
    cancelButton.className = 'text-red-500 hover:text-red-600';
    cancelButton.addEventListener('click', () => cancelRenaming(note, inputElement, titleSpan, buttonsDiv));

    titleSpan.replaceWith(inputElement);
    buttonsDiv.innerHTML = '';
    buttonsDiv.appendChild(saveButton);
    buttonsDiv.appendChild(cancelButton);

    inputElement.focus();
  }

  function finishRenaming(note, inputElement, titleSpan, buttonsDiv) {
    const newTitle = inputElement.value.trim();
    if (newTitle && newTitle !== note.title) {
      note.title = newTitle;
      saveCurrentNote();
    }
    cancelRenaming(note, inputElement, titleSpan, buttonsDiv);
  }

  function cancelRenaming(note, inputElement, titleSpan, buttonsDiv) {
    titleSpan.textContent = note.title;
    inputElement.replaceWith(titleSpan);
    updateNoteButtons(buttonsDiv);
  }

  function updateNoteButtons(buttonsDiv) {
    buttonsDiv.innerHTML = '';

    const renameButton = document.createElement('button');
    renameButton.innerHTML = '<i class="fas fa-edit"></i>';
    renameButton.className = 'text-blue-500 hover:text-blue-600 mr-2';
    renameButton.addEventListener('click', (e) => {
      e.stopPropagation();
      const noteElement = buttonsDiv.closest('[data-note-id]');
      const note = notes.find(n => n.id === noteElement.dataset.noteId);
      startRenaming(note, noteElement.querySelector('span'), buttonsDiv);
    });
    buttonsDiv.appendChild(renameButton);

    const deleteButton = document.createElement('button');
    deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
    deleteButton.className = 'text-red-500 hover:text-red-600';
    deleteButton.addEventListener('click', (e) => {
      e.stopPropagation();
      const noteElement = buttonsDiv.closest('[data-note-id]');
      deleteNote(noteElement.dataset.noteId);
    });
    buttonsDiv.appendChild(deleteButton);
  }

  async function deleteNote(noteId) {
    try {
      await ipcRenderer.invoke('delete-note', noteId);
      console.log('Note deleted successfully');
      loadFoldersAndNotes(); // Refresh the folder and note lists
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  }

  function loadNote(note) {
    currentNote = note;
    editor.root.innerHTML = note.content;
    noteTitleInput.value = note.title;
    folderSelect.value = note.folderId || '';
    showEditor();
  }

  function showEditor() {
    const mainContent = document.getElementById('main-content');
    const editorContainer = document.getElementById('editor-container');
    
    if (!editorContainer) {
      console.error('Editor container not found');
      return;
    }

    mainContent.innerHTML = '';
    mainContent.appendChild(editorContainer);
    editorContainer.style.display = 'flex';
  }

  function showRecentNotes() {
    const mainContent = document.getElementById('main-content');
    const editorContainer = document.getElementById('editor-container');
    
    if (editorContainer && editorContainer.parentNode) {
      editorContainer.parentNode.removeChild(editorContainer);
    }
    
    mainContent.innerHTML = '';

    const recentNotesHeader = document.createElement('h2');
    recentNotesHeader.textContent = 'Recent Notes';
    recentNotesHeader.className = 'text-2xl font-bold mb-4';
    mainContent.appendChild(recentNotesHeader);

    const sortedNotes = notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    const recentNotes = sortedNotes.slice(0, 5);

    recentNotes.forEach(note => {
      const noteElement = document.createElement('div');
      noteElement.className = 'bg-white dark:bg-gray-700 p-4 rounded-lg shadow-md mb-4 cursor-pointer';
      noteElement.innerHTML = `
        <h3 class="text-xl font-semibold">${note.title}</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">Last updated: ${new Date(note.updatedAt).toLocaleString()}</p>
      `;
      noteElement.addEventListener('click', () => loadNote(note));
      mainContent.appendChild(noteElement);
    });

    document.body.appendChild(editorContainer);
    editorContainer.style.display = 'none';
  }

  function toggleTheme() {
    document.documentElement.classList.toggle('dark');
  }

  async function saveFolders() {
    try {
      await ipcRenderer.invoke('save-folders', folders);
      console.log('Folders saved successfully');
    } catch (error) {
      console.error('Error saving folders:', error);
    }
  }

  // Add drag and drop functionality
  const folderList = document.getElementById('folder-list');
  folderList.addEventListener('dragover', (e) => {
    e.preventDefault();
    const folderElement = e.target.closest('.py-2');
    if (folderElement) {
      folderElement.classList.add('bg-gray-300', 'dark:bg-gray-600');
    }
  });

  folderList.addEventListener('dragleave', (e) => {
    const folderElement = e.target.closest('.py-2');
    if (folderElement) {
      folderElement.classList.remove('bg-gray-300', 'dark:bg-gray-600');
    }
  });

  folderList.addEventListener('drop', (e) => {
    e.preventDefault();
    const folderElement = e.target.closest('.py-2');
    if (folderElement) {
      folderElement.classList.remove('bg-gray-300', 'dark:bg-gray-600');
      const noteId = e.dataTransfer.getData('text/plain');
      const folderId = folderElement.dataset.folderId;
      moveNoteToFolder(noteId, folderId);
    }
  });

  async function moveNoteToFolder(noteId, folderId) {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      const oldFolderId = note.folderId;
      note.folderId = folderId;
      
      try {
        await ipcRenderer.invoke('save-note', note);
        console.log('Note moved successfully');
        
        // Update the UI
        if (oldFolderId) {
          updateFolderNotes(folders.find(f => f.id === oldFolderId));
        }
        if (folderId) {
          updateFolderNotes(folders.find(f => f.id === folderId));
        }
        updateNoteList();
      } catch (error) {
        console.error('Error moving note:', error);
        // Revert the change if saving failed
        note.folderId = oldFolderId;
      }
    }
  }

  // Home button functionality
  const homeButton = document.getElementById('home-button');
  homeButton.addEventListener('click', () => {
    showRecentNotes();
  });

  // Initial setup
  showRecentNotes();

  function startRenamingFolder(folder, folderSpan) {
    const inputElement = document.createElement('input');
    inputElement.type = 'text';
    inputElement.value = folder.name;
    inputElement.className = 'flex-grow mr-2 p-1 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-alchemy-red';

    const saveButton = document.createElement('button');
    saveButton.innerHTML = '<i class="fas fa-save"></i>';
    saveButton.className = 'text-green-500 hover:text-green-600 mr-2';
    saveButton.addEventListener('click', () => finishRenamingFolder(folder, inputElement));

    const cancelButton = document.createElement('button');
    cancelButton.innerHTML = '<i class="fas fa-times"></i>';
    cancelButton.className = 'text-red-500 hover:text-red-600';
    cancelButton.addEventListener('click', () => cancelRenamingFolder(folder));

    const container = folderSpan.parentElement;
    container.innerHTML = '';
    container.appendChild(inputElement);
    container.appendChild(saveButton);
    container.appendChild(cancelButton);

    inputElement.focus();
  }

  function finishRenamingFolder(folder, inputElement) {
    const newName = inputElement.value.trim();
    if (newName && newName !== folder.name) {
      folder.name = newName;
      saveFolders();
    }
    updateFolderList();
  }

  function cancelRenamingFolder(folder) {
    updateFolderList();
  }

  async function deleteFolder(folderId) {
    try {
      await ipcRenderer.invoke('delete-folder', folderId);
      folders = folders.filter(folder => folder.id !== folderId);
      notes = notes.filter(note => note.folderId !== folderId);
      updateFolderList();
      updateNoteList();
      console.log('Folder deleted successfully');
    } catch (error) {
      console.error('Error deleting folder:', error);
    }
  }
});
