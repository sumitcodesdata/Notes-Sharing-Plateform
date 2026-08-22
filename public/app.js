const API_URL = '/api';


let notesData = [];
let currentUser = null;
let currentTransactionNote = null;
let currentViewingNote = null;
let editingReviewId = null;


const notesGrid = document.getElementById("notes-grid");
const searchInput = document.getElementById("search-input");
const categoryFilter = document.getElementById("category-filter");
const universityFilter = document.getElementById("university-filter");
const priceFilter = document.getElementById("price-filter");
const uploadForm = document.getElementById("upload-form");
const editForm = document.getElementById("edit-form");
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const toastEl = document.getElementById("toast-notification");


document.addEventListener("DOMContentLoaded", async () => {
  await checkAuthSession();
  await fetchNotes();
  setupListeners();
});

function getHeaders(contentType = "application/json") {
  const headers = {};
  if (contentType) {
    headers["Content-Type"] = contentType;
  }
  const token = localStorage.getItem("token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}


async function checkAuthSession() {
  const token = localStorage.getItem("token");
  if (!token) {
    updateUserUI(null);
    return;
  }

  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      method: "GET",
      headers: getHeaders()
    });

    if (res.ok) {
      currentUser = await res.json();
      updateUserUI(currentUser);
    } else {
      localStorage.removeItem("token");
      updateUserUI(null);
    }
  } catch (err) {
    console.error("Auth check failed:", err);
    updateUserUI(null);
  }
}


async function fetchNotes() {
  const searchVal = searchInput.value;
  const categoryVal = categoryFilter.value;
  const universityVal = universityFilter.value;
  const priceVal = priceFilter.value;

  const queryParams = new URLSearchParams();
  if (searchVal) queryParams.append("search", searchVal);
  if (categoryVal) queryParams.append("category", categoryVal);
  if (universityVal) queryParams.append("university", universityVal);
  if (priceVal) queryParams.append("price", priceVal);

  try {
    const res = await fetch(`${API_URL}/notes?${queryParams.toString()}`);
    if (res.ok) {
      notesData = await res.json();
      renderNotes(notesData);
    } else {
      showToast("Failed to fetch study notes.", "error");
    }
  } catch (err) {
    console.error("Error fetching notes:", err);
    showToast("Server connection error.", "error");
  }
}


function showToast(message, type = "success") {
  const toastMsg = document.getElementById("toast-message");
  const toastIcon = document.getElementById("toast-icon");
  toastMsg.textContent = message;
  toastIcon.textContent = type === "success" ? "✅" : "ℹ️";
  toastEl.className = `toast show ${type === "success" ? "toast-success" : "toast-info"}`;
  
  setTimeout(() => {
    toastEl.classList.remove("show");
  }, 3000);
}


function renderNotes(notes) {
  notesGrid.innerHTML = "";
  
  if (notes.length === 0) {
    notesGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">No study notes found.</div>`;
    return;
  }
  
  const avatarGradients = [
    "linear-gradient(135deg, #6366f1, #a855f7)",
    "linear-gradient(135deg, #ec4899, #8b5cf6)",
    "linear-gradient(135deg, #06b6d4, #3b82f6)",
    "linear-gradient(135deg, #10b981, #059669)"
  ];
  
  notes.forEach((note, index) => {
    const card = document.createElement("div");
    card.className = "note-card";
    
    const stars = "★".repeat(Math.round(note.rating)) + "☆".repeat(5 - Math.round(note.rating));
    const priceText = note.isFree ? "Free" : `₹${note.price}`;
    
    // Choose avatar gradient from note id
    const code = note._id.charCodeAt(note._id.length - 1) || index;
    const avatarBg = avatarGradients[code % avatarGradients.length];
    
    const categoryClassMap = {
      "computer science": "badge-sky",
      "mathematics": "badge-violet",
      "physics": "badge-amber",
      "business": "badge-indigo"
    };
    const badgeClass = categoryClassMap[(note.category || '').toLowerCase()] || "badge-indigo";

    card.innerHTML = `
      <div class="card-details-trigger" data-id="${note._id}" style="cursor: pointer;">
        <div class="card-tags">
          <div class="badge-group">
            <span class="badge ${badgeClass}">${note.category}</span>
          </div>
          <span class="university-tag">${note.university}</span>
        </div>
        <h3 class="card-title">${note.title}</h3>
        <p class="card-description">${note.description}</p>
        <div class="card-author">
          <div class="author-avatar" style="background: ${avatarBg};">${note.authorName[0].toUpperCase()}</div>
          <span>Uploaded by <strong style="color: var(--text-main); font-weight: 500;">${note.authorName}</strong></span>
        </div>
      </div>

      <div class="card-footer">
        <div class="card-stats">
          <span class="stars-gold">${stars}</span>
          <span style="display:inline-block; margin-left: 0.25rem; font-size:0.8rem; font-weight:500; color:var(--text-main)">(${note.rating.toFixed(1)})</span>
          <span style="display:block; font-size:0.75rem; margin-top:0.25rem;">${note.downloads} downloads</span>
        </div>
        <div class="card-pricing" style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.25rem;">
          <span class="card-price ${note.isFree ? 'free' : ''}">${priceText}</span>
          <div style="display: flex; gap: 0.5rem; margin-top: 0.25rem;">
            <button class="btn btn-outline share-btn" data-id="${note._id}" style="padding:0.4rem 0.6rem; font-size:0.8rem;" title="Share link">
              Share 🔗
            </button>
            <button class="btn btn-primary action-btn" data-id="${note._id}" style="padding:0.4rem 0.8rem; font-size:0.8rem;">
              ${note.isFree ? "Download" : "Buy Now"}
            </button>
          </div>
        </div>
      </div>
    `;
    notesGrid.appendChild(card);
  });
}

function setupListeners() {
  searchInput.addEventListener("input", fetchNotes);
  categoryFilter.addEventListener("change", fetchNotes);
  universityFilter.addEventListener("change", fetchNotes);
  priceFilter.addEventListener("change", fetchNotes);
  
  let isUploading = false;
  uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isUploading) return;

    if (!currentUser) {
      window.location.hash = "#login-modal";
      showToast("Please log in to upload notes.", "info");
      return;
    }

    const submitBtn = uploadForm.querySelector("button[type='submit']");
    const originalBtnText = submitBtn.innerHTML;

    const title = document.getElementById("upload-title").value;
    const university = document.getElementById("upload-university").value;
    const category = document.getElementById("upload-category").value;
    const price = parseFloat(document.getElementById("upload-price").value) || 0;
    const description = document.getElementById("upload-description").value;
    const tagsInput = document.getElementById("upload-tags").value;
    const fileInput = document.getElementById("upload-file").files[0];
    
    const formData = new FormData();
    formData.append("pdf", fileInput);
    formData.append("title", title);
    formData.append("university", university);
    formData.append("category", category);
    formData.append("price", price);
    formData.append("description", description);
    formData.append("tags", tagsInput);
    
    try {
      isUploading = true;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner"></span> Publishing Note...`;

      const res = await fetch(`${API_URL}/notes`, {
        method: "POST",
        headers: getHeaders(null),
        body: formData
      });

      if (res.ok) {
        uploadForm.reset();
        window.location.hash = "#explore";
        showToast(`Successfully uploaded "${title}"!`);
        await fetchNotes();
      } else {
        const data = await res.json();
        showToast(data.message || "Failed to upload notes.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error connecting to server during upload.", "error");
    } finally {
      isUploading = false;
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("token", data.token);
        currentUser = data.user;
        updateUserUI(currentUser);
        window.location.hash = "#";
        loginForm.reset();
        showToast(`Welcome back, ${currentUser.name}!`);
        await fetchNotes();
      } else {
        showToast(data.message || "Login failed.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error connecting to auth server.", "error");
    }
  });

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("signup-name").value;
    const email = document.getElementById("signup-email").value;
    const password = document.getElementById("signup-password").value;
    
    try {
      const res = await fetch(`${API_URL}/auth/signup`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ name, email, password })
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("token", data.token);
        currentUser = data.user;
        updateUserUI(currentUser);
        window.location.hash = "#";
        signupForm.reset();
        showToast(`Welcome to NotesShare, ${name}!`);
        await fetchNotes();
      } else {
        showToast(data.message || "Signup failed.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error connecting to server.", "error");
    }
  });

  notesGrid.addEventListener("click", (e) => {
    const trigger = e.target.closest(".card-details-trigger");
    
    if (e.target.classList.contains("action-btn")) {
      const noteId = e.target.dataset.id;
      triggerPurchaseFlow(noteId);
    } else if (e.target.classList.contains("share-btn")) {
      const noteId = e.target.dataset.id;
      const note = notesData.find(n => n._id === noteId);
      const shareUrl = `${window.location.origin}${window.location.pathname}?note=${noteId}#explore`;
      
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast(`Copied share link for "${note.title}"!`);
      }).catch(() => {
        showToast("Failed to copy link.", "info");
      });
    } else if (trigger) {
      const noteId = trigger.dataset.id;
      renderNoteDetails(noteId);
      window.location.hash = "#view-note-modal";
    }
  });

  document.getElementById("confirm-transaction-btn").addEventListener("click", () => {
    if (!currentTransactionNote) return;
    
    const confirmBtn = document.getElementById("confirm-transaction-btn");
    const progress = document.getElementById("download-progress");
    const statusText = document.getElementById("progress-status");
    const fill = document.getElementById("progress-bar-fill");
    
    confirmBtn.disabled = true;
    progress.style.display = "block";
    fill.style.width = "100%";
    fill.style.transition = "width 1.2s ease";
    statusText.textContent = "Requesting secure download link...";
    
    setTimeout(() => {
      window.location.href = `${API_URL}/notes/${currentTransactionNote._id}/download`;
      
      showToast("Download completed successfully!");
      
      window.location.hash = "#";
      setTimeout(() => {
        progress.style.display = "none";
        fill.style.width = "0%";
        fill.style.transition = "none";
        confirmBtn.disabled = false;
        currentTransactionNote = null;
        fetchNotes();
      }, 300);
    }, 1200);
  });

  const tabBtns = document.querySelectorAll(".profile-tab-btn");
  const tabContents = document.querySelectorAll(".profile-tab-content");
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => {
        b.classList.remove("active");
        b.style.color = "var(--text-muted)";
        b.style.borderBottomColor = "transparent";
      });
      tabContents.forEach(c => c.style.display = "none");
      
      btn.classList.add("active");
      btn.style.color = "var(--text-main)";
      btn.style.borderBottomColor = "var(--primary-color)";
      
      const tabId = btn.dataset.tab;
      document.getElementById(tabId).style.display = "block";
      
      if (tabId === "tab-saved") {
        renderSavedNotes();
      } else if (tabId === "tab-dashboard") {
        renderDashboard();
      }
    });
  });

  const reviewForm = document.getElementById("review-form");
  const reviewSubmitBtn = document.getElementById("review-submit-btn");
  const reviewCancelBtn = document.getElementById("review-cancel-btn");

  if (reviewCancelBtn) {
    reviewCancelBtn.addEventListener("click", () => {
      editingReviewId = null;
      reviewForm.reset();
      if (reviewSubmitBtn) reviewSubmitBtn.textContent = "Post Review";
      reviewCancelBtn.style.display = "none";
    });
  }

  reviewForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentViewingNote) return;
    if (!currentUser) {
      window.location.hash = "#login-modal";
      showToast("Please log in to submit a review.", "info");
      return;
    }
    
    const ratingVal = parseInt(document.getElementById("review-rating").value) || 5;
    const commentText = document.getElementById("review-comment").value;
    
    try {
      const url = editingReviewId
        ? `${API_URL}/notes/${currentViewingNote._id}/reviews/${editingReviewId}`
        : `${API_URL}/notes/${currentViewingNote._id}/reviews`;
      
      const method = editingReviewId ? "PUT" : "POST";
      const isEditing = Boolean(editingReviewId);

      const res = await fetch(url, {
        method: method,
        headers: getHeaders(),
        body: JSON.stringify({ rating: ratingVal, text: commentText })
      });

      if (res.ok) {
        const updatedNote = await res.json();
        editingReviewId = null;
        reviewForm.reset();
        if (reviewSubmitBtn) reviewSubmitBtn.textContent = "Post Review";
        if (reviewCancelBtn) reviewCancelBtn.style.display = "none";
        await renderNoteDetails(updatedNote._id);
        await fetchNotes();
        showToast(isEditing ? "Review updated successfully!" : "Review submitted successfully!");
      } else {
        const data = await res.json();
        showToast(data.message || "Failed to submit review.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error connecting to server.", "error");
    }
  });

  window.addEventListener("hashchange", () => {
    if (window.location.hash === "#profile-modal") {
      renderDashboard();
    }
  });

  document.getElementById("settings-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const newName = document.getElementById("settings-name").value.trim();
    const newEmail = document.getElementById("settings-email").value.trim();
    const newPass = document.getElementById("settings-password").value;
    const confirmPass = document.getElementById("settings-confirm").value;

    if (newPass && newPass !== confirmPass) {
      showToast("Passwords do not match.", "error");
      return;
    }

    try {
      const payload = { name: newName, email: newEmail };
      if (newPass) payload.password = newPass;

      const res = await fetch(`${API_URL}/users/profile`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        currentUser = data;
        updateUserUI(currentUser);
        document.getElementById("settings-password").value = "";
        document.getElementById("settings-confirm").value = "";
        showToast("Settings saved successfully!");
      } else {
        showToast(data.message || "Failed to save settings.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Server error updating profile settings.", "error");
    }
  });

  let isUpdating = false;
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isUpdating) return;

    const noteId = document.getElementById("edit-note-id").value;
    const submitBtn = editForm.querySelector("button[type='submit']");
    const originalBtnText = submitBtn.innerHTML;

    const title = document.getElementById("edit-title").value;
    const university = document.getElementById("edit-university").value;
    const category = document.getElementById("edit-category").value;
    const price = parseFloat(document.getElementById("edit-price").value) || 0;
    const description = document.getElementById("edit-description").value;
    const tagsInput = document.getElementById("edit-tags").value;
    const fileInput = document.getElementById("edit-file").files[0];
    
    const formData = new FormData();
    if (fileInput) {
      formData.append("pdf", fileInput);
    }
    formData.append("title", title);
    formData.append("university", university);
    formData.append("category", category);
    formData.append("price", price);
    formData.append("description", description);
    formData.append("tags", tagsInput);

    try {
      isUpdating = true;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner"></span> Updating Note...`;

      const res = await fetch(`${API_URL}/notes/${noteId}`, {
        method: "PUT",
        headers: getHeaders(null),
        body: formData
      });

      if (res.ok) {
        editForm.reset();
        window.location.hash = "#explore";
        showToast(`Successfully updated "${title}"!`);
        await fetchNotes();
        if (currentUser) {
          await renderDashboard();
        }
      } else {
        const data = await res.json();
        showToast(data.message || "Failed to update note.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error connecting to server during update.", "error");
    } finally {
      isUpdating = false;
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  });
}

function updateUserUI(user) {
  const body = document.body;
  if (user) {
    body.classList.add("is-logged-in");
    document.getElementById("header-user-name").textContent = user.name;
    document.getElementById("header-user-avatar").textContent = user.name[0].toUpperCase();
    
    const sName = document.getElementById("settings-name");
    const sEmail = document.getElementById("settings-email");
    if (sName) sName.value = user.name;
    if (sEmail) sEmail.value = user.email;

    const logoutBtn = document.getElementById("logout-btn");
    logoutBtn.replaceWith(logoutBtn.cloneNode(true));
    document.getElementById("logout-btn").addEventListener("click", () => {
      localStorage.removeItem("token");
      currentUser = null;
      updateUserUI(null);
      window.location.hash = "#";
      showToast("Logged out successfully.", "info");
      fetchNotes();
    });
  } else {
    body.classList.remove("is-logged-in");
  }
}

function triggerPurchaseFlow(noteId) {
  currentTransactionNote = notesData.find(n => n._id === noteId);
  if (!currentTransactionNote) return;

  const title = document.getElementById("purchase-modal-title");
  const subtitle = document.getElementById("purchase-modal-subtitle");
  const confirmBtn = document.getElementById("confirm-transaction-btn");
  
  if (currentTransactionNote.isFree) {
    title.textContent = "Download Notes";
    subtitle.innerHTML = `You are downloading: <strong>${currentTransactionNote.title}</strong> (Free)`;
    confirmBtn.textContent = "Download Now";
  } else {
    title.textContent = "Purchase Notes";
    subtitle.innerHTML = `Confirm purchase of: <strong>${currentTransactionNote.title}</strong> for ₹${currentTransactionNote.price}`;
    confirmBtn.textContent = `Pay ₹${currentTransactionNote.price} & Download`;
  }
  
  window.location.hash = "#purchase-success-modal";
}

async function renderNoteDetails(noteId) {
  try {
    const res = await fetch(`${API_URL}/notes/${noteId}`);
    if (!res.ok) {
      showToast("Error retrieving note details.", "error");
      return;
    }
    
    const note = await res.json();
    currentViewingNote = note;
    
    document.getElementById("view-note-title").textContent = note.title;
    document.getElementById("view-note-university").textContent = note.university;
    document.getElementById("view-note-author").textContent = note.authorName;
    document.getElementById("view-note-downloads-count").textContent = `${note.downloads} downloads`;
    document.getElementById("view-note-rating-score").textContent = `(${note.rating.toFixed(1)})`;
    
    const stars = "★".repeat(Math.round(note.rating)) + "☆".repeat(5 - Math.round(note.rating));
    document.getElementById("view-note-stars").textContent = stars;
    
    document.getElementById("view-note-preview-header").textContent = `Course Outline & Notes Preview`;
    document.getElementById("view-note-preview-paragraph").textContent = `${note.description} This document serves as study reference sheets for courses at ${note.university}. Standard pages cover formulas, core definitions, and curriculum summaries.`;
    
    const categoryClassMap = {
      "computer science": "badge-sky",
      "mathematics": "badge-violet",
      "physics": "badge-amber",
      "business": "badge-indigo"
    };
    const badgeClass = categoryClassMap[(note.category || '').toLowerCase()] || "badge-indigo";

    const badgesEl = document.getElementById("view-note-badges");
    badgesEl.innerHTML = `
      <span class="badge ${badgeClass}">${note.category}</span>
    `;
    
    const downloadBtn = document.getElementById("view-note-download-btn");
    downloadBtn.textContent = note.isFree ? "Download Now" : `Buy Now for ₹${note.price}`;
    downloadBtn.replaceWith(downloadBtn.cloneNode(true));
    document.getElementById("view-note-download-btn").addEventListener("click", () => {
      window.location.hash = "#";
      setTimeout(() => {
        triggerPurchaseFlow(note._id);
      }, 200);
    });
    
    const saveBtn = document.getElementById("view-note-save-btn");
    let isSaved = false;

    if (currentUser) {
      try {
        const bookmarksRes = await fetch(`${API_URL}/users/bookmarks`, {
          method: "GET",
          headers: getHeaders()
        });
        if (bookmarksRes.ok) {
          const savedList = await bookmarksRes.json();
          isSaved = savedList.some(n => n._id === note._id);
        }
      } catch (err) {
        console.error("Error checking bookmark list:", err);
      }
    }

    saveBtn.textContent = isSaved ? "Saved 🔖" : "Save Note 🔖";
    saveBtn.className = isSaved ? "btn btn-primary" : "btn btn-outline";
    saveBtn.replaceWith(saveBtn.cloneNode(true));
    document.getElementById("view-note-save-btn").addEventListener("click", async () => {
      if (!currentUser) {
        window.location.hash = "#login-modal";
        showToast("Please log in to save bookmarks.", "info");
        return;
      }

      try {
        const bookmarkRes = await fetch(`${API_URL}/notes/${note._id}/bookmark`, {
          method: "POST",
          headers: getHeaders()
        });
        
        if (bookmarkRes.ok) {
          const result = await bookmarkRes.json();
          showToast(result.saved ? "Bookmarked successfully!" : "Removed from bookmarks.", "info");
          await renderNoteDetails(note._id);
        } else {
          showToast("Failed to toggle bookmark.", "error");
        }
      } catch (err) {
        console.error(err);
      }
    });
    
    renderCommentsList(note);

    const authorActionsEl = document.getElementById("view-note-author-actions");
    if (currentUser && note.author === (currentUser._id || currentUser.id)) {
      authorActionsEl.style.display = "flex";
      
      const editBtn = document.getElementById("view-note-edit-btn");
      editBtn.replaceWith(editBtn.cloneNode(true));
      document.getElementById("view-note-edit-btn").addEventListener("click", () => {
        window.location.hash = "#";
        setTimeout(() => {
          openEditModal(note._id);
        }, 150);
      });
      
      const deleteBtn = document.getElementById("view-note-delete-btn");
      deleteBtn.replaceWith(deleteBtn.cloneNode(true));
      document.getElementById("view-note-delete-btn").addEventListener("click", () => {
        window.location.hash = "#";
        setTimeout(() => {
          deleteNote(note._id, note.title);
        }, 150);
      });
    } else {
      authorActionsEl.style.display = "none";
    }
  } catch (err) {
    console.error("Error loading note details:", err);
  }
}

function renderCommentsList(note) {
  const listEl = document.getElementById("view-note-comments-list");
  listEl.innerHTML = "";
  
  if (!note.reviews || note.reviews.length === 0) {
    listEl.innerHTML = `<div style="text-align: center; padding: 1.5rem; color: var(--text-muted); font-size: 0.85rem;">No reviews yet. Be the first to rate!</div>`;
    return;
  }
  
  note.reviews.forEach(review => {
    const starsStr = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
    const item = document.createElement("div");
    item.className = "comment-item";

    const isAuthor = currentUser && (
      (review.author && (review.author === currentUser._id || review.author === currentUser.id)) ||
      review.authorName === currentUser.name
    );

    const actionButtons = isAuthor ? `
      <div style="display: flex; gap: 0.35rem;">
        <button class="btn btn-outline edit-review-btn" data-id="${review._id}" style="padding: 0.15rem 0.4rem; font-size: 0.7rem;">Edit ✏️</button>
        <button class="btn btn-outline delete-review-btn" data-id="${review._id}" style="padding: 0.15rem 0.4rem; font-size: 0.7rem; color: var(--danger-color, #ef4444); border-color: rgba(239, 68, 68, 0.4);">Delete 🗑️</button>
      </div>
    ` : '';

    item.innerHTML = `
      <div class="comment-header" style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <span class="comment-author">${review.authorName}</span>
          <span class="stars-gold" style="font-size: 0.75rem; margin-left: 0.5rem;">${starsStr}</span>
        </div>
        ${actionButtons}
      </div>
      <div class="comment-text" style="margin-top: 0.25rem;">${review.text}</div>
    `;

    if (isAuthor) {
      const editBtn = item.querySelector(".edit-review-btn");
      if (editBtn) {
        editBtn.addEventListener("click", () => {
          editingReviewId = review._id;
          document.getElementById("review-rating").value = review.rating;
          document.getElementById("review-comment").value = review.text;
          const submitBtn = document.getElementById("review-submit-btn");
          const cancelBtn = document.getElementById("review-cancel-btn");
          if (submitBtn) submitBtn.textContent = "Update Review";
          if (cancelBtn) cancelBtn.style.display = "inline-block";
          document.getElementById("review-comment").focus();
        });
      }

      const deleteBtn = item.querySelector(".delete-review-btn");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", async () => {
          if (!confirm("Are you sure you want to delete your review?")) return;
          try {
            const res = await fetch(`${API_URL}/notes/${note._id}/reviews/${review._id}`, {
              method: "DELETE",
              headers: getHeaders()
            });

            if (res.ok) {
              const updatedNote = await res.json();
              showToast("Review deleted.", "info");
              await renderNoteDetails(updatedNote._id);
              await fetchNotes();
            } else {
              const data = await res.json();
              showToast(data.message || "Failed to delete review.", "error");
            }
          } catch (err) {
            console.error(err);
          }
        });
      }
    }

    listEl.appendChild(item);
  });
}

async function renderDashboard() {
  if (!currentUser) return;
  
  try {
    const res = await fetch(`${API_URL}/users/dashboard`, {
      method: "GET",
      headers: getHeaders()
    });

    if (res.ok) {
      const data = await res.json();
      
      document.getElementById("dashboard-total-downloads").textContent = data.totalDownloads.toLocaleString();
      document.getElementById("dashboard-total-earnings").textContent = `₹${data.totalEarnings.toFixed(2)}`;
      
      const listEl = document.getElementById("dashboard-notes-list");
      listEl.innerHTML = "";
      
      if (data.notes.length === 0) {
        listEl.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.9rem;">You haven't uploaded any notes yet.</div>`;
        return;
      }
      
      data.notes.forEach(note => {
        const item = document.createElement("div");
        item.className = "dashboard-item";
        item.innerHTML = `
          <div style="flex: 1; min-width: 0; padding-right: 1rem; text-align: left;">
            <div style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-main);">${note.title}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;">${note.university}</div>
          </div>
          <div style="text-align: right; flex-shrink: 0; display: flex; align-items: center; gap: 1rem;">
            <div style="text-align: right;">
              <div style="font-weight: 700; color: var(--text-main);">${note.downloads} downloads</div>
              <div style="font-size: 0.75rem; color: var(--success-color); margin-top: 0.2rem;">Earned ₹${(note.downloads * note.price * 0.70).toFixed(0)}</div>
            </div>
            <div style="display: flex; gap: 0.35rem;">
              <button class="btn btn-outline edit-note-dash-btn" style="padding: 0.35rem 0.6rem; font-size: 0.75rem; border-color: var(--info-color); color: var(--info-color);">Edit</button>
              <button class="btn btn-outline delete-note-dash-btn" style="padding: 0.35rem 0.6rem; font-size: 0.75rem; border-color: rgba(239, 68, 68, 0.5); color: rgb(248, 113, 113);">Delete</button>
            </div>
          </div>
        `;
        
        item.querySelector(".edit-note-dash-btn").addEventListener("click", () => {
          window.location.hash = "#";
          setTimeout(() => {
            openEditModal(note._id);
          }, 150);
        });

        item.querySelector(".delete-note-dash-btn").addEventListener("click", () => {
          window.location.hash = "#";
          setTimeout(() => {
            deleteNote(note._id, note.title);
          }, 150);
        });

        listEl.appendChild(item);
      });
    }
  } catch (err) {
    console.error("Dashboard render failed:", err);
  }
}

async function renderSavedNotes() {
  if (!currentUser) return;

  try {
    const res = await fetch(`${API_URL}/users/bookmarks`, {
      method: "GET",
      headers: getHeaders()
    });

    if (res.ok) {
      const bookmarked = await res.json();
      const listEl = document.getElementById("saved-notes-list");
      listEl.innerHTML = "";
      
      if (bookmarked.length === 0) {
        listEl.innerHTML = `<div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted); font-size: 0.9rem;">You haven't bookmarked any notes yet.</div>`;
        return;
      }
      
      bookmarked.forEach(note => {
        const item = document.createElement("div");
        item.className = "dashboard-item";
        item.innerHTML = `
          <div style="flex: 1; min-width: 0; padding-right: 1rem; text-align: left;">
            <div style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-main);">${note.title}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;">${note.university}</div>
          </div>
          <div style="text-align: right; flex-shrink: 0; display: flex; gap: 0.5rem; align-items: center;">
            <a href="#view-note-modal" class="btn btn-primary" onclick="renderNoteDetails('${note._id}')" style="padding: 0.35rem 0.75rem; font-size: 0.75rem;">View</a>
            <button class="btn btn-outline" onclick="removeBookmark('${note._id}')" style="padding: 0.35rem 0.5rem; font-size: 0.75rem;">Unsave</button>
          </div>
        `;
        listEl.appendChild(item);
      });
    }
  } catch (err) {
    console.error("Bookmarks render failed:", err);
  }
}

window.removeBookmark = async function(noteId) {
  try {
    const res = await fetch(`${API_URL}/notes/${noteId}/bookmark`, {
      method: "POST",
      headers: getHeaders()
    });
    
    if (res.ok) {
      showToast("Removed from bookmarks.", "info");
      await renderSavedNotes();
    } else {
      showToast("Failed to remove bookmark.", "error");
    }
  } catch (err) {
    console.error(err);
  }
};

async function openEditModal(noteId) {
  try {
    const res = await fetch(`${API_URL}/notes/${noteId}`);
    if (!res.ok) {
      showToast("Error retrieving note details for editing.", "error");
      return;
    }

    const note = await res.json();
    document.getElementById("edit-note-id").value = note._id;
    document.getElementById("edit-title").value = note.title;
    document.getElementById("edit-university").value = note.university;
    document.getElementById("edit-category").value = note.category;
    document.getElementById("edit-price").value = note.price;
    document.getElementById("edit-tags").value = note.tags.join(', ');
    document.getElementById("edit-description").value = note.description;
    

    document.getElementById("edit-file").value = "";

    window.location.hash = "#edit-modal";
  } catch (err) {
    console.error(err);
    showToast("Error connecting to server.", "error");
  }
}

async function deleteNote(noteId, title) {
  if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

  try {
    const res = await fetch(`${API_URL}/notes/${noteId}`, {
      method: "DELETE",
      headers: getHeaders()
    });

    if (res.ok) {
      showToast(`Successfully deleted "${title}"!`);
      window.location.hash = "#explore";
      await fetchNotes();
      if (currentUser) {
        await renderDashboard();
      }
    } else {
      const data = await res.json();
      showToast(data.message || "Failed to delete note.", "error");
    }
  } catch (err) {
    console.error(err);
    showToast("Error connecting to server during deletion.", "error");
  }
}
