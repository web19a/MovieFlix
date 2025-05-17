const API_KEY = '88bd3fd0643df4b81a75e258ad357df1'; // REPLACE WITH YOUR API KEY
const API_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// State Management
let currentMediaId = null;
let currentMediaType = null;
let currentUser = null;
let activeType = 'home';
let activeGenre = null;
let searchQuery = '';
const genres = {
    movie: {},
    tv: {}
};

// DOM Elements
const sections = {
    home: document.getElementById('home-section'),
    movie: document.getElementById('movie-section'),
    tv: document.getElementById('tv-section')
};

sections['my-list'] = document.getElementById('my-list-section');

const grids = {
    home: document.getElementById('home-grid'),
    movie: document.getElementById('movie-grid'),
    tv: document.getElementById('tv-grid'),
    'my-list': document.getElementById('my-list-grid') // Add this line
};

const loaders = {
    home: document.getElementById('home-loader'),
    movie: document.getElementById('movie-loader'),
    tv: document.getElementById('tv-loader')
};

const errors = {
    home: document.getElementById('home-error'),
    movie: document.getElementById('movie-error'),
    tv: document.getElementById('tv-error')
};

let currentLists = {
    'watch-later': {
        name: 'Watch Later',
        items: []
    },
    'favorites': {
        name: 'Favorites',
        items: []
    }
};

const detailOverlay = document.getElementById('detail-overlay');
const detailClose = document.getElementById('detail-close');

// Initialize
fetchGenres();
setupEventListeners();
loadInitialContent();

async function fetchGenres() {
    try {
        const [movieRes,
            tvRes] = await Promise.all([
                fetch(`${API_URL}/genre/movie/list?api_key=${API_KEY}`),
                fetch(`${API_URL}/genre/tv/list?api_key=${API_KEY}`)
            ]);

        genres.movie = await movieRes.json().then(data =>
            data.genres.reduce((acc, g) => ({
                ...acc, [g.id]: g.name
            }), {}));
        genres.tv = await tvRes.json().then(data =>
            data.genres.reduce((acc, g) => ({
                ...acc, [g.id]: g.name
            }), {}));
    } catch (error) {
        console.error('Error loading genres:', error);
    }
}

function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', handleNavClick);
    });

    // Search
    document.getElementById('search-input').addEventListener('input', handleSearch);

    // Genre Filter
    document.getElementById('genre-filter').addEventListener('click', handleGenreClick);

    // Detail Overlay
    detailClose.addEventListener('click', closeDetailOverlay);
    detailOverlay.addEventListener('click', (e) => {
        if (e.target === detailOverlay) closeDetailOverlay();
    });
    document.addEventListener('keydown',
        (e) => {
            if (e.key === 'Escape') closeDetailOverlay();
        });

    // Media Card Clicks
    document.addEventListener('click',
        async (e) => {
            const mediaCard = e.target.closest('.media-card');
            if (mediaCard) {
                try {
                    const mediaId = mediaCard.dataset.mediaId;
                    const mediaType = mediaCard.dataset.mediaType; // Get actual media type
                    await showDetailOverlay(mediaId, mediaType);
                } catch (error) {
                    console.error('Detailed Error:', error);
                    alert('Failed to load details. Please try again.');
                }
            }
        });
}

async function handleNavClick(e) {
    e.preventDefault();
    const type = e.target.dataset.type;
    if (type === activeType) return;

    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    e.target.classList.add('active');
    activeType = type;

    updateGenreFilters(type);

    if (type === 'my-list') {
        document.querySelector('.hero').style.display = 'none'
        document.getElementById('footer').style.position = 'fixed'
        document.getElementById('footer').style.bottom = '0'
        document.getElementById('footer').style.width = '100vw'
    } else {
        document.querySelector('.hero').style.display = 'flex'
        document.getElementById('footer').style.position = 'relative'
    }

    if (!grids[type].innerHTML) await fetchContent(type);
    showSection(type);
}

function updateGenreFilters(type) {
    const genreFilter = document.getElementById('genre-filter');
    genreFilter.innerHTML = '';

    if (type === 'home' || type === 'my-list') return;

    Object.entries(genres[type]).forEach(([id, name]) => {
        const button = document.createElement('button');
        button.className = `genre-btn ${activeGenre === id ? 'active': ''}`;
        button.textContent = name;
        button.dataset.genreId = id;
        genreFilter.appendChild(button);
    });
}

function handleGenreClick(e) {
    if (!e.target.classList.contains('genre-btn')) return;

    const genreId = e.target.dataset.genreId;
    activeGenre = activeGenre === genreId ? null: genreId;

    document.querySelectorAll('.genre-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.genreId === genreId && activeGenre);
    });

    refreshContent();
}

async function handleSearch(e) {
    searchQuery = e.target.value.trim();
    refreshContent();
}

async function refreshContent() {
    if (searchQuery.length > 2) {
        await searchContent();
    } else {
        await fetchContent(activeType);
    }
}

async function fetchContent(type = activeType) {
    try {
        showLoading(type);
        const endpoint = type === 'home' ? '/trending/all/week': `/${type}/popular`;
        const url = `${API_URL}${endpoint}?api_key=${API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        displayContent(filterContent(data.results), type);
    } catch (error) {
        showError(`Failed to load ${type} content`, type);
    }
}

async function searchContent() {
    try {
        showLoading(activeType);
        const type = activeType === 'home' ? 'multi': activeType;
        const url = `${API_URL}/search/${type}?api_key=${API_KEY}&query=${encodeURIComponent(searchQuery)}`;
        const response = await fetch(url);
        const data = await response.json();
        displayContent(filterContent(data.results), activeType);
    } catch (error) {
        showError(`Search failed for ${activeType}`, activeType);
    }
}

function filterContent(items) {
    return items.filter(item => {
        // Validate item structure
        const isValid = item?.id &&
        typeof item.id === 'number' &&
        (item.title || item.name);

        if (!isValid) {
            console.warn('Filtering invalid item:', item);
            return false;
        }

        // Genre filter check
        if (activeGenre) {
            return item.genre_ids?.includes(Number(activeGenre));
        }

        return true;
    });
}

function displayContent(items, type) {
    console.log('Displaying items:',
        items.map(item => ({
            id: item.id,
            title: item.title || item.name,
            valid: typeof item.id === 'number'
        })));

    grids[type].innerHTML = items.map(item => createMediaCard(item)).join('');
    hideLoading(type);
}

function createMediaCard(item) {
    // Handle My List items
    const isMyListItem = item.media_type === 'movie' || item.media_type === 'tv';
    let mediaType = isMyListItem ? item.media_type: (item.media_type || (item.title ? 'movie': 'tv'));

    // Fallback for My List items
    const title = item.title || item.name;
    const year = (item.release_date || item.first_air_date)?.slice(0,
        4) || 'N/A';
    const rating = item.vote_average?.toFixed(1) || '0.0';

    if (!item?.id || typeof item.id !== 'number') {
        console.error('Skipping invalid item:', item);
        return '';
    }

    // Proper media type detection
    mediaType = item.media_type || (item.title ? 'movie': 'tv');

    return `
    <div class="media-card"
    data-media-id="${item.id}"
    data-media-type="${mediaType}"> <!-- Correct attribute -->
    <img src="${item.poster_path ? IMAGE_BASE_URL + item.poster_path: 'https://via.placeholder.com/300x450?text=No+Poster'}"
    alt="${mediaType === 'movie' ? item.title: item.name}"
    class="media-poster">
    <div class="media-info">
    <h3 class="media-title">${mediaType === 'movie' ? item.title: item.name}</h3>
    <p class="media-details">
    ⭐ ${(item.vote_average || 0).toFixed(1)}/10 |
    ${(mediaType === 'movie' ? item.release_date: item.first_air_date)?.slice(0, 4) || 'N/A'}
    </p>
    </div>
    </div>
    `;
}
async function showDetailOverlay(id, mediaType) {
    try {
        currentMediaId = id;
        currentMediaType = mediaType;

        if (!['movie', 'tv'].includes(mediaType)) {
            throw new Error(`Invalid media type: ${mediaType}`);
        }

        const numericId = Number(id);
        if (!numericId || isNaN(numericId)) {
            throw new Error(`Invalid media ID: ${id}`);
        }

        // Fetch details and videos
        const details = await fetchDetails(numericId, mediaType);
        const videos = await fetch(
            `${API_URL}/${mediaType}/${numericId}/videos?api_key=${API_KEY}`
        ).then(r => r.json());

        // Populate overlay data
        populateDetailOverlay(details, mediaType === 'movie');

        // Handle trailer (basic implementation)
        const trailer = videos.results.find(vid => vid.type === 'Trailer');
        if (trailer) {
            document.getElementById('trailer-iframe').src = `https://www.youtube.com/embed/${trailer.key}`;
            document.getElementById('trailer-iframe').style.display = 'block';
            document.getElementById('no-trailer').style.display = 'none';
        } else {
            document.getElementById('trailer-iframe').style.display = 'none';
            document.getElementById('no-trailer').style.display = 'block';
        }

        // Show the overlay
        detailOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';

    } catch (error) {
        console.error('Detailed Error:', {
            error: error.message,
            id,
            mediaType,
            API_KEY: API_KEY ? '***': 'MISSING'
        });
        alert('Failed to load details. Please try again.');
        closeDetailOverlay();
    }


}
async function fetchDetails(id, mediaType) {
    try {
        const url = `${API_URL}/${mediaType}/${id}?api_key=${API_KEY}`;
        const response = await fetch(url);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.status_message || 'Unknown API error');
        }

        const data = await response.json();

        if (!data.id || (!data.title && !data.name)) {
            throw new Error('Invalid media data format');
        }

        return data;
    } catch (error) {
        console.error('Fetch Details Error:', {
            error: error.message,
            id,
            mediaType,
            API_KEY: API_KEY ? '***': 'MISSING'
        });
        throw error;
    }
}

function populateDetailOverlay(data, isMovie) {
    const safeData = data || {};

    // Populate basic info
    document.getElementById('detail-title').textContent =
    safeData.title || safeData.name || 'Title not available';

    const posterPath = safeData.poster_path || '';
    document.getElementById('detail-poster').src = posterPath ?
    IMAGE_BASE_URL + posterPath:
    'https://via.placeholder.com/300x450?text=No+Poster';

    const dateString = isMovie ?
    safeData.release_date:
    safeData.first_air_date;
    document.getElementById('detail-year').textContent =
    dateString?.slice(0, 4) || 'N/A';

    document.getElementById('detail-runtime').textContent = isMovie ?
    `${safeData.runtime || 'N/A'} mins`:
    `${safeData.number_of_episodes || 'N/A'} episodes (${safeData.number_of_seasons || 'N/A'} seasons)`;

    document.getElementById('detail-rating').textContent =
    (safeData.vote_average || 0).toFixed(1);

    document.getElementById('detail-overview').textContent =
    safeData.overview || 'No overview available';

    const genresContainer = document.getElementById('detail-genres');
    genresContainer.innerHTML = (safeData.genres || [])
    .map(g => `<span class="detail-genre">${g.name}</span>`)
    .join('') || '<span class="detail-genre">No genres listed</span>';

    // Watch Later functionality
    const watchLaterBtn = document.getElementById('watch-later-btn');
    const mediaType = isMovie ? 'movie': 'tv';
    const mediaId = safeData.id;
    const title = safeData.title || safeData.name;

    // Reset button state
    watchLaterBtn.classList.remove('added');
    watchLaterBtn.disabled = false;
    watchLaterBtn.textContent = 'Add to Watch Later';
    watchLaterBtn.onclick = null;

    // User validation
    if (!currentUser) {
        watchLaterBtn.textContent = 'Login to Add to Watch Later';
        watchLaterBtn.disabled = true;
        return;
    }

    // Check existing entries
    const userList = currentUser.list || [];
    const exists = userList.some(item =>
        item.id === mediaId && item.type === mediaType
    );

    if (exists) {
        watchLaterBtn.classList.add('added');
        watchLaterBtn.textContent = 'In Your List';
        watchLaterBtn.disabled = true;
    } else {
        watchLaterBtn.onclick = () => {
            const newItem = {
                id: mediaId,
                type: mediaType,
                title: title,
                posterPath: posterPath,
                addedAt: new Date().toISOString()
            };

            // Update current user
            currentUser.list = [...userList,
                newItem];

            // Update localStorage
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            const userIndex = users.findIndex(u => u.email === currentUser.email);
            if (userIndex !== -1) {
                users[userIndex] = currentUser;
                localStorage.setItem('users', JSON.stringify(users));
            }

            if (sections['my-list'].classList.contains('active')) {
                loadMyListContent();
            }

            // Update UI
            watchLaterBtn.classList.add('added');
            watchLaterBtn.textContent = 'In Your List';
            watchLaterBtn.disabled = true;
        };
    }

    // Additional metadata
    const extraInfo = document.getElementById('detail-extra');
    extraInfo.innerHTML = `
    ${safeData.tagline ? `<p>"${safeData.tagline}"</p>`: ''}
    ${isMovie ? `
    <p>Budget: $${(safeData.budget || 0).toLocaleString()}</p>
    <p>Revenue: $${(safeData.revenue || 0).toLocaleString()}</p>
    `: `
    <p>Status: ${safeData.status || 'N/A'}</p>
    <p>Last Air Date: ${safeData.last_air_date || 'N/A'}</p>
    `}
    `;

    // Add to populateDetailOverlay function
    const ratingContainer = document.createElement('div');
    ratingContainer.className = 'rating-container';
    ratingContainer.innerHTML = `
    <span>Rate this:</span>
    <div class="star-rating">
    ${[1,
        2,
        3,
        4,
        5].map(i => `
        <span class="star" data-rating="${i}">☆</span>
        `).join('')}
    </div>
    `;

    document.querySelector('.detail-info').prepend(ratingContainer);

    // Star rating logic
    document.querySelectorAll('.star').forEach(star => {
        star.addEventListener('click', (e) => {
            const rating = parseInt(e.target.dataset.rating);
            const mediaId = safeData.id;
            const mediaType = isMovie ? 'movie': 'tv';

            // Store rating
            const users = JSON.parse(localStorage.getItem('users'));
            const user = users.find(u => u.email === currentUser.email);
            user.ratings = user.ratings || {};
            user.ratings[`${mediaType}-${mediaId}`] = rating;
            localStorage.setItem('users', JSON.stringify(users));

            // Update UI
            document.querySelectorAll('.star').forEach((s, idx) => {
                s.textContent = idx < rating ? '★': '☆';
            });
        });
    });

    populateListSelector();
}

function closeDetailOverlay() {
    detailOverlay.classList.remove('active');
    document.body.style.overflow = 'auto';
    document.getElementById('watch-later-btn').onclick = null;
}

function showSection(type) {
    Object.values(sections).forEach(s => s.classList.remove('active'));
    sections[type].classList.add('active');

    if (type === 'my-list' && currentUser) {
        loadMyListContent();
    }
}

function showLoading(type) {
    loaders[type].style.display = 'block';
    errors[type].style.display = 'none';
}

function hideLoading(type) {
    loaders[type].style.display = 'none';
}

function showError(message, type) {
    errors[type].textContent = message;
    errors[type].style.display = 'block';
    hideLoading(type);
}

function loadInitialContent() {
    fetchContent('home');
    fetchContent('movie');
    fetchContent('tv');

    if (currentUser) {
        currentLists = currentUser.lists || currentLists;
        refreshListUI();
    }
}

// Add My List to sections

// Auth Event Listeners
document.getElementById('login').addEventListener('submit', handleLogin);
document.getElementById('register').addEventListener('submit', handleRegister);

function showLogin() {
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('register-form').style.display = 'none';
}

function showRegister() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
}

function handleLogin(e) {
    e.preventDefault();
    const email = e.target[0].value;
    const password = e.target[1].value;

    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
        currentUser = user;
        updateAuthUI();
        showSection('my-list');
    } else {
        alert('Invalid credentials');
    }
}

function handleRegister(e) {
    e.preventDefault();
    const user = {
        name: e.target[0].value,
        email: e.target[1].value,
        password: e.target[2].value,
        list: []
    };

    const users = JSON.parse(localStorage.getItem('users') || '[]');
    if (users.some(u => u.email === user.email)) {
        alert('Email already exists');
        return;
    }

    users.push(user);
    localStorage.setItem('users', JSON.stringify(users));
    currentUser = user;
    updateAuthUI();
    showSection('my-list');
}

function updateAuthUI() {
    const isLoggedIn = !!currentUser;
    document.getElementById('auth-container').style.display = isLoggedIn ? 'none': 'block';
    document.getElementById('my-list-grid').style.display = isLoggedIn ? 'grid': 'none';

    if (isLoggedIn) {
        if (!document.getElementById('logout-btn')) {
            const logoutBtn = document.createElement('button');
            logoutBtn.id = 'logout-btn';
            logoutBtn.className = 'logout-btn';
            logoutBtn.textContent = 'Logout';
            logoutBtn.onclick = () => {
                currentUser = null;
                updateAuthUI();
                showSection('home');
            };
            document.getElementById('my-list-section').appendChild(logoutBtn);
        }

        if (sections['my-list'].classList.contains('active')) loadMyListContent();
    } else {
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) logoutBtn.remove();
    }

    if (detailOverlay.classList.contains('active')) {
        showDetailOverlay(currentMediaId, currentMediaType);
    }

    if (currentUser?.lists) {
        currentLists = currentUser.lists;
        refreshListUI();
    }
}

function loadMyListContent() {
    const myListGrid = document.getElementById('my-list-grid');
    myListGrid.innerHTML = '';

    if (!currentUser?.list?.length) {
        myListGrid.innerHTML = '<p class="empty-list">Your watch later list is empty</p>';
        return;
    }

    myListGrid.innerHTML = currentUser.list.map(item => {
        // Convert stored items to API-like format
        const apiFormatItem = {
            id: item.id,
            title: item.title,
            name: item.type === 'tv' ? item.title: undefined,
            poster_path: item.posterPath,
            vote_average: item.voteAverage,
            release_date: item.type === 'movie' ? item.releaseDate: undefined,
            first_air_date: item.type === 'tv' ? item.releaseDate: undefined,
            media_type: item.type
        };

        return createMediaCard(apiFormatItem);
    }).join('');
}

async function getRecommendations() {
    if (!currentUser) return;

    // Get user's top rated genre
    const genreCounts = currentUser.ratings ?
    Object.values(currentUser.ratings).reduce((acc, {
        genre
    }) => {
        acc[genre] = (acc[genre] || 0) + 1;
        return acc;
    }, {}): {};

    const topGenre = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || '28'; // Fallback to Action

    // Fetch recommendations
    const response = await fetch(
        `${API_URL}/discover/movie?api_key=${API_KEY}&with_genres=${topGenre}`
    );
    const data = await response.json();

    // Display in new section
    const recSection = document.createElement('div');
    recSection.className = 'content-section';
    recSection.innerHTML = `
    <h2>Recommended for You</h2>
    <div class="media-grid" id="recommendations-grid"></div>
    `;

    document.body.insertBefore(recSection, document.querySelector('footer'));
    displayContent(data.results, 'recommendations');
}

document.getElementById('create-list-btn').addEventListener('click', () => {
    const listName = prompt('Enter name for new list:');
    if (listName) {
        const listKey = listName.toLowerCase().replace(/\s+/g, '-');
        currentLists[listKey] = {
            name: listName,
            items: []
        };
        updateListStorage();
        refreshListUI();
    }
});

function updateListStorage() {
    const users = JSON.parse(localStorage.getItem('users'));
    const userIndex = users.findIndex(u => u.email === currentUser.email);
    users[userIndex].lists = currentLists;
    localStorage.setItem('users',
        JSON.stringify(users));
}

function populateListSelector() {
    const selector = document.getElementById('list-selector');
    selector.innerHTML = '<option value="">Add to List...</option>';

    Object.entries(currentLists).forEach(([key, list]) => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = list.name;
        selector.appendChild(option);
    });
}

document.getElementById('confirm-add-list').addEventListener('click', () => {
    const listKey = document.getElementById('list-selector').value;
    if (listKey) {
        addToCurrentList(listKey);
    }
});

async function addToCurrentList(listKey) {
    const mediaItem = {
        id: currentMediaId,
        type: currentMediaType,
        title: document.getElementById('detail-title').textContent,
        posterPath: document.getElementById('detail-poster').src.replace(IMAGE_BASE_URL,
            '')
    };

    currentLists[listKey].items.push(mediaItem);
    updateListStorage();
    refreshListUI();
    closeDetailOverlay();
}