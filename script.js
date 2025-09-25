     // ---------- Globals ----------
     let currentPokemonId = 1;
    let allPokemon = []; // { id, name }
    let activeSuggestionIndex = -1; // for arrow key navigation

        // ---------- Utilities ----------
        function extractIdFromUrl(url) {
      // URLs look like .../pokemon/25/ -> grab the number
      const parts = url.split("/").filter(Boolean);
      return parseInt(parts[parts.length - 1], 10);
    }

    // Simple Levenshtein distance (edit distance)
    function levenshtein(a, b) {
      a = a.toLowerCase(); b = b.toLowerCase();
      const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
      for (let i = 0; i <= a.length; i++) dp[i][0] = i;
      for (let j = 0; j <= b.length; j++) dp[0][j] = j;
      for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
          const cost = a[i - 1] === b[j - 1] ? 0 : 1;
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,      // deletion
            dp[i][j - 1] + 1,      // insertion
            dp[i - 1][j - 1] + cost // substitution
          );
        }
      }
      return dp[a.length][b.length];
    }

    // Score a name against query (lower is better distance, but we boost startsWith/substring)
    function scoreName(name, query) {
      name = name.toLowerCase();
      query = query.toLowerCase();
      const dist = levenshtein(name, query);
      let score = -dist; // more negative = worse
      if (name === query) score += 100;
      if (name.startsWith(query)) score += 20;
      if (name.includes(query)) score += 10;
      return score;
    }

    // Render suggestions below the input
    function renderSuggestions(list) {
      const ul = document.getElementById("suggestions");
      ul.innerHTML = "";
      if (!list.length) {
        ul.style.display = "none";
        activeSuggestionIndex = -1;
        return;
      }
      list.forEach((p, idx) => {
        const li = document.createElement("li");
        li.innerHTML = `<span>${p.name}</span><span class="pill">#${p.id}</span>`;
        if (idx === activeSuggestionIndex) li.classList.add("active");
        li.addEventListener("mousedown", (e) => {
          // mousedown instead of click to avoid input blur first
          selectSuggestion(p);
        });
        ul.appendChild(li);
      });
      ul.style.display = "block";
    }

    function selectSuggestion(p) {
      document.getElementById("searchInput").value = p.name;
      hideSuggestions();
      getPokemon(p.id);
    }

    function hideSuggestions() {
      const ul = document.getElementById("suggestions");
      ul.style.display = "none";
      activeSuggestionIndex = -1;
    }

// Show three Pokémon: either by center ID or by an array of IDs
async function showThreePokemon(centerOrIds) {
  let ids;
  if (Array.isArray(centerOrIds)) {
    ids = centerOrIds; // Use the provided IDs directly
  } else {
    ids = [centerOrIds - 1, centerOrIds, centerOrIds + 1];
  }
  const container = document.getElementById("pokedex-container");
  container.innerHTML = ""; // Clear old Pokémon
  let foundAny = false;
  for (let id of ids) {
    if (id < 1) continue;
    try {
      const url = `https://pokeapi.co/api/v2/pokemon/${id}`;
      const speciesUrl = `https://pokeapi.co/api/v2/pokemon-species/${id}`;
      const [data, speciesData] = await Promise.all([
        fetch(url).then(r => {
          if (!r.ok) throw new Error("not-found");
          return r.json();
        }),
        fetch(speciesUrl).then(r => {
          if (!r.ok) throw new Error("not-found");
          return r.json();
        })
      ]);
      foundAny = true;
      const pokemonName = data.name;
      const pokemonImage = data.sprites.front_default || data.sprites.other?.["official-artwork"]?.front_default;
      const types = data.types.map(t => t.type.name).join(", ");
      const flavorTextEntry = speciesData.flavor_text_entries.find(
        entry => entry.language.name === "en"
      );
      const pokemonDescription = flavorTextEntry
        ? flavorTextEntry.flavor_text.replace(/\n|\f/g, " ")
        : "No description available.";
      const statsHTML = data.stats.map(s => {
        return `<li><strong>${s.stat.name}:</strong> ${s.base_stat}</li>`;
      }).join("");
      const card = document.createElement("div");
      card.classList.add("pokemon-card");
      card.innerHTML = `
        <h2>#${data.id} ${pokemonName}</h2>
        <div class="img-row">
          <img src="${pokemonImage}" alt="${pokemonName}">
          <div class="meta">
            <div><strong>Height:</strong> ${data.height}</div>
            <div><strong>Weight:</strong> ${data.weight}</div>
            <div><strong>Types:</strong> ${types}</div>
          </div>
        </div>
        <p><strong>Description:</strong> ${pokemonDescription}</p>
        <h3>Stats</h3>
        <ul class="stats">${statsHTML}</ul>
      `;
      container.appendChild(card);
    } catch (err) {
      // If a Pokémon is not found, skip it
    }
  }
  if (!foundAny) {
    container.innerHTML = `<div class="error">No Pokémon found for this ID.</div>`;
  }
}

  // Initial Pokémon
  //getPokemon(currentPokemonId);
    // ---------- Init: preload all names for fuzzy search ----------
    async function preloadNames() {
      // Get a big list of Pokémon (main dex). Increase limit if you want more forms.
      const res = await fetch("https://pokeapi.co/api/v2/pokemon?limit=2000");
      const json = await res.json();
      allPokemon = json.results.map(r => ({
        name: r.name,
        id: extractIdFromUrl(r.url),
      })).filter(p => !isNaN(p.id)); // keep valid ids only
      // You can sort if you like (not required): allPokemon.sort((a,b)=>a.id-b.id);
    }

// Buttons
document.getElementById("nextBtn").addEventListener("click", () => {
  // If the current group is the last group (centered at 1024), show error
  /*if (currentPokemonId >= 1024) {
    const container = document.getElementById("pokedex-container");
    container.innerHTML = `<div class="error">No Pokémon found for this ID.</div>`;
    return;
  }*/
  currentPokemonId++;
  showThreePokemon(currentPokemonId);
});

document.getElementById("prevBtn").addEventListener("click", () => {
  if (currentPokemonId > 2) { // So you always have three to show
    currentPokemonId--;
    showThreePokemon(currentPokemonId);
  }
});

// Show the very first Pokémon (and its neighbors)
document.getElementById("firstBtn").addEventListener("click", () => {
  currentPokemonId = 2; // Center on the second Pokémon
  showThreePokemon([1, 2, 3]);
});

document.getElementById("lastBtn").addEventListener("click", () => {
  // Get the last three Pokémon from the list
  const lastThree = allPokemon.slice(-3);
  if (lastThree.length === 0) return;
  // Pass their actual IDs to showThreePokemon
  showThreePokemon(lastThree.map(p => p.id));
});



document.getElementById("searchBtn").addEventListener("click", () => {
  const value = document.getElementById("searchInput").value.trim();
  if (!value) return;
  if (/^\d+$/.test(value)) {
    // If user typed a number, go directly by ID
    hideSuggestions();
    currentPokemonId = parseInt(value, 10); // <--- update currentPokemonId!
    showThreePokemon(currentPokemonId);
  } else {
    // If it's text, open top fuzzy match
    const top = fuzzyTopMatches(value, 1)[0];
    if (top) {
      hideSuggestions();
      currentPokemonId = top.id; // <--- update currentPokemonId!
      showThreePokemon(currentPokemonId);
    } else {
      hideSuggestions();
      showThreePokemon(value); // try directly (API will show not-found if wrong)
    }
  }
});

    // Live suggestions as you type
    const searchInput = document.getElementById("searchInput");
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.trim();
      if (!q || /^\d+$/.test(q)) {
        // hide suggestions if empty or user is typing an ID number
        hideSuggestions();
        return;
      }
      const list = fuzzyTopMatches(q, 7);
      renderSuggestions(list);
    });

    // Keyboard navigation for suggestions
    searchInput.addEventListener("keydown", (e) => {
      const ul = document.getElementById("suggestions");
      const visible = ul.style.display !== "none";
      const items = Array.from(ul.children);

      if (visible && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        if (items.length === 0) return;
        if (e.key === "ArrowDown") {
          activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length;
        } else {
          activeSuggestionIndex = (activeSuggestionIndex - 1 + items.length) % items.length;
        }
        renderSuggestions(items.map((li, i) => {
          // Rebuild list state without changing content
          return { name: li.querySelector("span").textContent, id: parseInt(li.querySelector(".pill").textContent.slice(1),10) };
        }));
        // reapply "active" class
        const newItems = Array.from(document.getElementById("suggestions").children);
        newItems.forEach((li, i) => {
          if (i === activeSuggestionIndex) li.classList.add("active");
        });
      } else if (e.key === "Enter") {
        // Enter: open active suggestion or the top match
        const q = searchInput.value.trim();
        if (!q) return;
        if (/^\d+$/.test(q)) {
          hideSuggestions();
          showThreePokemon(parseInt(q, 10));
          return;
        }
        const list = fuzzyTopMatches(q, 7);
        if (visible && activeSuggestionIndex >= 0 && list[activeSuggestionIndex]) {
          e.preventDefault();
          const chosen = list[activeSuggestionIndex];
          hideSuggestions();
          showThreePokemon(chosen.id);
        } else {
          // no active: use the best match
          const top = list[0];
          hideSuggestions();
          if (top) showThreePokemon(top.id);
          else showThreePokemon(q);
        }
      } else if (e.key === "Escape") {
        hideSuggestions();
      }
    });

    // Click outside to close suggestions
    document.addEventListener("click", (e) => {
      const wrap = document.querySelector(".search-wrap");
      if (!wrap.contains(e.target)) hideSuggestions();
    });

      // Return top N fuzzy matches
      function fuzzyTopMatches(query, n = 5) {
      if (!allPokemon.length) return [];
      const scored = allPokemon.map(p => ({
        ...p,
        _score: scoreName(p.name, query)
      }));
      scored.sort((a, b) => b._score - a._score);
      return scored.slice(0, n);
    }

    // ---------- Boot ----------
    (async function init() {
      await preloadNames();    // load names for fuzzy search
      await showThreePokemon(currentPokemonId); // show three Pokémon first
    })();