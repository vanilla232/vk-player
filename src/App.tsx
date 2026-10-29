import { useState, useEffect, useRef } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import './App.css';

interface Track {
  id: number;
  owner_id: number;
  artist: string;
  title: string;
  duration: number;
  url?: string;
  cover_url?: string;
}

interface Playlist {
  id: string;
  owner_id?: string;
  title: string;
  description?: string;
  count: number;
  access_key?: string;
  cover_url?: string;
}

type TabType = 'my_music' | 'search' | 'playlists' | 'vk_mix' | 'cached';
type RepeatMode = 'none' | 'one' | 'all';

const IconPlay = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>;
const IconPause = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>;
const IconPrev = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>;
const IconNext = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>;
const IconShuffle = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>;
const IconRepeat = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>;
const IconVolume = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>;
const IconHeart = ({ filled }: { filled: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
);
const IconExpand = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>;
const IconRefresh = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>;
const IconCheck = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>;
const IconTrash = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>;
const IconDownload = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>;
const IconCopy = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>;
const IconRadio = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11a9 9 0 0 1 9 9"></path><path d="M4 4a16 16 0 0 1 16 16"></path><circle cx="5" cy="19" r="1"></circle></svg>;
const IconChevron = ({ isOpen }: { isOpen: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

const TrackSkeleton = () => (
  <div className="track-item skeleton-item">
    <div className="track-index skeleton" style={{ width: 20, height: 20 }}></div>
    <div className="track-cover skeleton"></div>
    <div className="track-info" style={{ gap: '8px', marginLeft: '10px' }}>
      <div className="skeleton" style={{ width: '40%', height: '16px', borderRadius: '4px' }}></div>
      <div className="skeleton" style={{ width: '20%', height: '12px', borderRadius: '4px' }}></div>
    </div>
  </div>
);

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<TabType>('my_music');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [myTracks, setMyTracks] = useState<Track[]>([]);
  const [searchTracks, setSearchTracks] = useState<Track[]>([]);
  const [mixTracks, setMixTracks] = useState<Track[]>([]);
  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>([]);
  const [mixPlaylists, setMixPlaylists] = useState<Playlist[]>([]);
  const [cachedTracks, setCachedTracks] = useState<Track[]>([]);
  
  const [myMusicOffset, setMyMusicOffset] = useState(0);
  const [hasMoreMyMusic, setHasMoreMyMusic] = useState(true);
  const [searchOffset, setSearchOffset] = useState(0);
  const [hasMoreSearch, setHasMoreSearch] = useState(true);
  const [hasMoreMix, setHasMoreMix] = useState(true);

  const [openedPlaylist, setOpenedPlaylist] = useState<Playlist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);

  const [isFetching, setIsFetching] = useState(false);
  const [isVkMixLoading, setIsVkMixLoading] = useState(false);
  const [vkMixError, setVkMixError] = useState<string | null>(null);

  const [addedTracks, setAddedTracks] = useState<Record<string, boolean>>({});
  
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('none');
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMiniPlayer, setIsMiniPlayer] = useState(false); 
  
  const [downloadedTracks, setDownloadedTracks] = useState<Record<string, string>>({});
  const [downloadingTracks, setDownloadingTracks] = useState<Record<string, boolean>>({});
  const [currentAudioSrc, setCurrentAudioSrc] = useState<string | undefined>(undefined);

  const [isPlaylistsExpanded, setIsPlaylistsExpanded] = useState(true);
  const [isMixPlaylistsExpanded, setIsMixPlaylistsExpanded] = useState(true);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef<Record<string, number>>({});

  const isVkMixFetchingRef = useRef(false);
  const vkMixRequestIdRef = useRef(0);
  const currentSeedRef = useRef<string | null>(null); 

  const downloadedTracksRef = useRef(downloadedTracks);
  useEffect(() => {
    downloadedTracksRef.current = downloadedTracks;
  }, [downloadedTracks]);

  const playNextRef = useRef<() => void>(() => {});
  const playPrevRef = useRef<() => void>(() => {});
  const togglePlayPauseRef = useRef<() => void>(() => {});

  const progressPercent = currentTrack ? (currentTime / currentTrack.duration) * 100 : 0;
  const volumePercent = volume * 100;

  const getAudioSrc = (track: Track) => {
    const trackKey = `${track.owner_id}_${track.id}`;
    if (downloadedTracksRef.current[trackKey]) {
      return convertFileSrc(downloadedTracksRef.current[trackKey]);
    }
    return track.url;
  };

  const checkIsLiked = (track: Track) => {
    if (!track) return false;
    return myTracks.some(t => t.id === track.id && t.owner_id === track.owner_id) || !!addedTracks[`${track.owner_id}_${track.id}`];
  };

  const loadCache = async () => {
    try {
      const cachedPaths = await invoke<Record<string, string>>('get_cached_files');
      if (cachedPaths) {
        setDownloadedTracks(cachedPaths);
        localStorage.setItem('downloadedTracks', JSON.stringify(cachedPaths));

        const savedList = localStorage.getItem('cachedTrackList');
        let parsedList: Track[] = [];
        if (savedList) {
          try { parsedList = JSON.parse(savedList); } catch { parsedList = []; }
        }
        const validTracks = parsedList.filter(
          t => t && t.id && t.owner_id && cachedPaths[`${t.owner_id}_${t.id}`] !== undefined
        );
        setCachedTracks(validTracks);
        localStorage.setItem('cachedTrackList', JSON.stringify(validTracks));
      }
    } catch (e) {
      console.error('Ошибка синхронизации кэша:', e);
    }
  };

  useEffect(() => {
    invoke<boolean>('check_auth').then(async (auth) => {
      if (auth) {
        setIsLoggedIn(true);
        fetchMyMusic(0, true);
        invoke('init_discord').catch(e => console.error(e));
      } else {
        setIsLoggedIn(false);
      }
      await loadCache();
    }).catch(async () => {
      setIsLoggedIn(false);
      await loadCache();
    });
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const handleError = () => {
      console.error("Ошибка воспроизведения аудио");
      setIsPlaying(false);
      invoke('update_media_metadata', { title: 'Ошибка', artist: 'Трек недоступен', coverUrl: null, isPlaying: false }).catch(() => {});
      invoke('clear_discord').catch(() => {});
    };

    audio.addEventListener('error', handleError);
    return () => audio.removeEventListener('error', handleError);
  }, []);

  useEffect(() => {
    if (currentTrack) {
      downloadTrack(currentTrack);
    }
  }, [currentTrack]);

  useEffect(() => {
    if (isLoggedIn) {
      invoke('init_media_controls').catch(e => console.error(e));
      const unlistenPlay = listen('media_play', () => { if (audioRef.current) { audioRef.current.play().catch(console.error); setIsPlaying(true); } });
      const unlistenPause = listen('media_pause', () => { if (audioRef.current) { audioRef.current.pause(); setIsPlaying(false); } });
      const unlistenToggle = listen('media_toggle', () => togglePlayPauseRef.current());
      const unlistenNext = listen('media_next', () => playNextRef.current());
      const unlistenPrev = listen('media_prev', () => playPrevRef.current());
      return () => {
        unlistenPlay.then(f => f()); unlistenPause.then(f => f()); unlistenToggle.then(f => f());
        unlistenNext.then(f => f()); unlistenPrev.then(f => f());
      };
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (currentTrack) {
      const updateMetadata = () => {
        invoke('update_media_metadata', { title: currentTrack.title, artist: currentTrack.artist, coverUrl: currentTrack.cover_url || null, isPlaying: isPlaying }).catch(e => console.error(e));
        if (isPlaying) {
          invoke('update_discord', { title: currentTrack.title, artist: currentTrack.artist, coverUrl: currentTrack.cover_url || null, currentTime: Math.floor(currentTime), duration: currentTrack.duration }).catch(e => console.error(e));
        } else {
          invoke('clear_discord').catch(e => console.error(e));
        }
      };

      updateMetadata(); 
      const interval = setInterval(updateMetadata, 5000); 

      return () => clearInterval(interval);
    }
  }, [currentTrack, isPlaying]);

  useEffect(() => {
    if (currentTrack) {
      setCurrentAudioSrc(getAudioSrc(currentTrack));
    }
  }, [currentTrack]);

  useEffect(() => {
    if (!currentTrack) return;
    let activeList: Track[] | null = null;

    if (openedPlaylist) {
      if (playlistTracks.some(t => t.id === currentTrack.id && t.owner_id === currentTrack.owner_id)) activeList = playlistTracks;
    } else {
      if (activeTab === 'my_music' && myTracks.some(t => t.id === currentTrack.id && t.owner_id === currentTrack.owner_id)) activeList = myTracks;
      else if (activeTab === 'vk_mix' && mixTracks.some(t => t.id === currentTrack.id && t.owner_id === currentTrack.owner_id)) activeList = mixTracks;
      else if (activeTab === 'search' && searchTracks.some(t => t.id === currentTrack.id && t.owner_id === currentTrack.owner_id)) activeList = searchTracks;
      else if (activeTab === 'cached' && cachedTracks.some(t => t.id === currentTrack.id && t.owner_id === currentTrack.owner_id)) activeList = cachedTracks;
    }

    if (activeList && queue !== activeList) {
      setQueue(activeList);
      const newIndex = activeList.findIndex(t => t.id === currentTrack.id && t.owner_id === currentTrack.owner_id);
      if (newIndex !== -1 && newIndex !== queueIndex) setQueueIndex(newIndex);
    }
  }, [myTracks, mixTracks, searchTracks, playlistTracks, cachedTracks, activeTab, openedPlaylist, currentTrack]);

  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);

  useEffect(() => {
    if (!loadMoreRef.current) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetching && !isVkMixLoading) {
          if (!openedPlaylist && !isOfflineMode) {
            if (activeTab === 'my_music' && hasMoreMyMusic) fetchMyMusic(myMusicOffset);
            else if (activeTab === 'search' && hasMoreSearch) fetchSearch(searchQuery, searchOffset);
            else if (activeTab === 'vk_mix' && hasMoreMix) fetchVkMix(false);
          }
        }
      },
      { root: scrollRef.current, rootMargin: '100px' }
    );
    
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [
    activeTab, hasMoreMyMusic, hasMoreSearch, hasMoreMix, 
    myMusicOffset, searchOffset, openedPlaylist, isOfflineMode,
    isFetching, isVkMixLoading, mixTracks.length
  ]);

  const downloadTrack = async (track: Track) => {
    const trackKey = `${track.owner_id}_${track.id}`;
    
    if (downloadedTracksRef.current[trackKey]) {
      setCachedTracks(prev => {
        if (prev.find(t => t.id === track.id && t.owner_id === track.owner_id)) return prev;
        const newList = [track, ...prev];
        localStorage.setItem('cachedTrackList', JSON.stringify(newList));
        return newList;
      });
      return;
    }

    if (downloadingTracks[trackKey] || !track.url) return;

    setDownloadingTracks(prev => ({ ...prev, [trackKey]: true }));
    try {
      const filename = `${trackKey}.mp3`;
      const localPath = await invoke<string>('download_track', { url: track.url, filename });
      
      setDownloadedTracks(prev => {
        const newDict = { ...prev, [trackKey]: localPath };
        localStorage.setItem('downloadedTracks', JSON.stringify(newDict));
        return newDict;
      });

      setCachedTracks(prev => {
        if (prev.find(t => t.id === track.id && t.owner_id === track.owner_id)) return prev;
        const newList = [track, ...prev];
        localStorage.setItem('cachedTrackList', JSON.stringify(newList));
        return newList;
      });
    } catch (error) {
      console.error("Ошибка скачивания:", error);
    } finally {
      setDownloadingTracks(prev => {
        const newDict = { ...prev };
        delete newDict[trackKey];
        return newDict;
      });
    }
  };

  const syncCacheWithMyMusic = () => {
    setCachedTracks(prev => {
      const newCached = [...prev];
      let added = false;
      myTracks.forEach(track => {
        const key = `${track.owner_id}_${track.id}`;
        if (downloadedTracksRef.current[key] && !newCached.find(t => t.id === track.id && t.owner_id === track.owner_id)) {
          newCached.push(track);
          added = true;
        }
      });
      if (added) {
        localStorage.setItem('cachedTrackList', JSON.stringify(newCached));
        return newCached;
      }
      return prev;
    });
  };

  const deleteCachedTrack = async (e: React.MouseEvent | null, track: Track) => {
    if (e) e.stopPropagation();
    const trackKey = `${track.owner_id}_${track.id}`;
    const filename = `${trackKey}.mp3`;
    
    try {
      await invoke('delete_cached_track', { filename });
      setDownloadedTracks(prev => {
        const newDict = { ...prev };
        delete newDict[trackKey];
        localStorage.setItem('downloadedTracks', JSON.stringify(newDict));
        return newDict;
      });
      setCachedTracks(prev => {
        const newList = prev.filter(t => t.id !== track.id || t.owner_id !== track.owner_id);
        localStorage.setItem('cachedTrackList', JSON.stringify(newList));
        return newList;
      });
    } catch (error) { alert(`Ошибка: ${error}`); }
  };

  const copyTrackName = (e: React.MouseEvent, track: Track) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${track.artist} - ${track.title}`);
  };

  const fetchMyMusic = async (offset: number, isInitial = false) => {
    if (isFetching || (!hasMoreMyMusic && !isInitial)) return;
    setIsFetching(true);
    try {
      const music = await invoke<Track[]>('get_my_music', { offset });
      if (music.length === 0) setHasMoreMyMusic(false);
      else {
        setMyTracks(prev => isInitial ? music : [...prev, ...music]);
        setMyMusicOffset(offset + 50);
      }
    } catch (error) { setErrorMsg(String(error)); } finally { setIsFetching(false); }
  };

  const fetchSearch = async (query: string, offset: number, isInitial = false) => {
    if (!query.trim() || isFetching || (!hasMoreSearch && !isInitial)) return;
    setIsFetching(true);
    try {
      const tracks = await invoke<Track[]>('search_music', { query, offset });
      if (tracks.length === 0) setHasMoreSearch(false);
      else {
        setSearchTracks(prev => isInitial ? tracks : [...prev, ...tracks]);
        setSearchOffset(offset + 50);
      }
    } catch (error) { setErrorMsg(String(error)); } finally { setIsFetching(false); }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchTracks([]);
    setSearchOffset(0);
    setHasMoreSearch(true);
    fetchSearch(searchQuery, 0, true);
  };

  const fetchVkMix = async (isInitial = false, seedAudio: string | null = null) => {
    if (!isInitial && isVkMixFetchingRef.current) return;
    if (!isInitial && !hasMoreMix) return;

    isVkMixFetchingRef.current = true;
    setIsVkMixLoading(true);
    setVkMixError(null);

    const requestId = ++vkMixRequestIdRef.current;
    const currentOffset = isInitial ? 0 : mixTracks.length;

    try {
      let finalSeed = seedAudio;
      if (!isInitial && !finalSeed && mixTracks.length > 0) {
        const lastTrack = mixTracks[mixTracks.length - 1];
        finalSeed = `${lastTrack.owner_id}_${lastTrack.id}`;
      }
      
      const [tracks, playlists] = await invoke<[Track[], Playlist[]]>('get_vk_mix', { offset: currentOffset, seedAudio: finalSeed });
      
      if (requestId !== vkMixRequestIdRef.current) return;

      if (tracks.length === 0) {
        setHasMoreMix(false);
      } else {
        const existingKeys = new Set(isInitial ? [] : mixTracks.map(t => `${t.owner_id}_${t.id}`));
        const uniqueNewTracks = tracks.filter(t => !existingKeys.has(`${t.owner_id}_${t.id}`));
        
        if (uniqueNewTracks.length === 0 && !isInitial) {
          setHasMoreMix(false);
        } else {
          setMixTracks(prev => isInitial ? uniqueNewTracks : [...prev, ...uniqueNewTracks]);
        }
      }
      if (playlists && playlists.length > 0) {
        setMixPlaylists(playlists);
      } else if (isInitial) {
        setMixPlaylists([]);
      }
    } catch (error) {
      if (requestId === vkMixRequestIdRef.current) {
        console.error("Ошибка загрузки VK Mix:", error);
        setVkMixError(String(error));
      }
    } finally {
      if (requestId === vkMixRequestIdRef.current) {
        isVkMixFetchingRef.current = false;
        setIsVkMixLoading(false);
      }
    }
  };

  const handleStartRadio = (track: Track) => {
    const seed = `${track.owner_id}_${track.id}`;
    currentSeedRef.current = seed;
    setMixTracks([]);
    setMixPlaylists([]);
    setHasMoreMix(true);
    setActiveTab('vk_mix');
    fetchVkMix(true, seed);
  };

  const handleRefreshMix = () => {
    setMixTracks([]);
    setMixPlaylists([]);
    setHasMoreMix(true);
    setVkMixError(null);
    isVkMixFetchingRef.current = false;
    const seed = currentSeedRef.current;
    fetchVkMix(true, seed);
  };

  const fetchUserPlaylists = async () => {
    setIsFetching(true);
    try {
      const playlists = await invoke<Playlist[]>('get_playlists');
      setUserPlaylists(playlists);
    } catch (error) { setErrorMsg(String(error)); } finally { setIsFetching(false); }
  };

  const openPlaylist = async (playlist: Playlist) => {
    setOpenedPlaylist(playlist);
    setIsFetching(true);
    setPlaylistTracks([]);
    try {
      const tracks = await invoke<Track[]>('get_playlist_tracks', {
        ownerId: playlist.owner_id || null,
        playlistId: playlist.id,
        accessKey: playlist.access_key || null
      });
      setPlaylistTracks(tracks);
    } catch (error) { setErrorMsg(String(error)); } finally { setIsFetching(false); }
  };

  const closePlaylist = () => {
    setOpenedPlaylist(null);
    setPlaylistTracks([]);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (openedPlaylist || isOfflineMode) return;
    scrollPositions.current[activeTab] = e.currentTarget.scrollTop;
  };

  const handleTabChange = (tab: TabType) => {
    if (isOfflineMode && (tab === 'my_music' || tab === 'search' || tab === 'playlists' || tab === 'vk_mix')) {
      alert("В оффлайн-режиме доступны только скачанные треки.");
      return;
    }

    setActiveTab(tab);
    closePlaylist();
    
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollPositions.current[tab] || 0;
      }
    }, 10);

    if (tab === 'my_music' && myTracks.length === 0) fetchMyMusic(0, true);
    if (tab === 'playlists' && userPlaylists.length === 0) fetchUserPlaylists();
    if (tab === 'vk_mix' && mixTracks.length === 0) fetchVkMix(true);
  };

  const handleSaveToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await invoke('save_token', { token: tokenInput });
      setIsLoggedIn(true);
      setTokenInput('');
      fetchMyMusic(0, true);
      invoke('init_discord').catch(e => console.error(e));
      await loadCache();
    } catch (error) { setErrorMsg(String(error)); } finally { setIsLoading(false); }
  };

  const handleOfflineLogin = async () => {
    try {
      const cachedPaths = await invoke<Record<string, string>>('get_cached_files');
      if (cachedPaths) {
        setDownloadedTracks(cachedPaths);
        localStorage.setItem('downloadedTracks', JSON.stringify(cachedPaths));
      }
    } catch (e) {
      console.error('Ошибка синхронизации кэша:', e);
    }

    const savedList = localStorage.getItem('cachedTrackList');
    const parsed: Track[] = savedList ? JSON.parse(savedList) : [];

    if (parsed.length === 0) {
      setErrorMsg('Нет скачанных треков для оффлайн-режима.');
      return;
    }

    setCachedTracks(parsed);
    setIsOfflineMode(true);
    setIsLoggedIn(true);
    setActiveTab('cached');
  };

  const playTrack = (track: Track, trackList: Track[] = []) => {
    setQueue(trackList.length > 0 ? trackList : [track]);
    const index = trackList.findIndex(t => t.id === track.id);
    setQueueIndex(index >= 0 ? index : 0);
    setCurrentTrack(track);
    setIsPlaying(true);
    setCurrentTime(0);
    setCurrentAudioSrc(getAudioSrc(track));
    downloadTrack(track);
    setTimeout(() => { if (audioRef.current) audioRef.current.play().catch(e => console.error(e)); }, 100);
  };

  const handleToggleFavorite = async (e: React.MouseEvent, track: Track) => {
    if (isOfflineMode) return;
    e.stopPropagation();
    const trackKey = `${track.owner_id}_${track.id}`;
    const isCurrentlyInMyMusic = myTracks.some(t => t.id === track.id && t.owner_id === track.owner_id);
    const isCurrentlyAdded = isCurrentlyInMyMusic || addedTracks[trackKey];
    
    try {
      await invoke('toggle_favorite', { audioId: track.id, ownerId: track.owner_id, add: !isCurrentlyAdded });
      setAddedTracks(prev => ({ ...prev, [trackKey]: !isCurrentlyAdded }));
      
      if (!isCurrentlyAdded) {
        if (!isCurrentlyInMyMusic) {
          setMyTracks(prev => [track, ...prev]);
        }
      } else {
        setMyTracks(prev => prev.filter(t => t.id !== track.id || t.owner_id !== track.owner_id));
      }
    } catch (error) {
      alert(`Ошибка: ${error}`);
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current || !currentTrack) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play().catch(e => console.error(e));
    setIsPlaying(!isPlaying);
  };

  const playPrev = () => {
    if (audioRef.current && audioRef.current.currentTime > 5) { audioRef.current.currentTime = 0; setCurrentTime(0); return; }
    if (queue.length === 0) return;
    let prevIndex = isShuffle ? Math.floor(Math.random() * queue.length) : (queueIndex - 1 + queue.length) % queue.length;
    setQueueIndex(prevIndex);
    setCurrentTrack(queue[prevIndex]);
    setCurrentAudioSrc(getAudioSrc(queue[prevIndex]));
    setCurrentTime(0);
    setTimeout(() => { if (audioRef.current) audioRef.current.play().catch(e => console.error(e)); }, 100);
  };

  const playNext = () => {
    if (queue.length === 0) return;
    let nextIndex = repeatMode === 'one' ? queueIndex : (isShuffle ? Math.floor(Math.random() * queue.length) : (queueIndex + 1) % queue.length);
    setQueueIndex(nextIndex);
    setCurrentTrack(queue[nextIndex]);
    setCurrentAudioSrc(getAudioSrc(queue[nextIndex]));
    setCurrentTime(0);
    setTimeout(() => { if (audioRef.current) audioRef.current.play().catch(e => console.error(e)); }, 100);
  };

  useEffect(() => { playNextRef.current = playNext; playPrevRef.current = playPrev; togglePlayPauseRef.current = togglePlayPause; });

  const restartTrack = () => { if (audioRef.current) { audioRef.current.currentTime = 0; setCurrentTime(0); } };
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
      if (currentTrack && isPlaying && !isOfflineMode) {
        invoke('update_discord', { title: currentTrack.title, artist: currentTrack.artist, coverUrl: currentTrack.cover_url || null, currentTime: Math.floor(time), duration: currentTrack.duration }).catch(e => console.error(e));
      }
    }
  };
  const handleTrackEnd = () => { if (repeatMode === 'one') { if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play(); } } else { playNext(); } };
  const toggleRepeatMode = () => { if (repeatMode === 'none') setRepeatMode('all'); else if (repeatMode === 'all') setRepeatMode('one'); else setRepeatMode('none'); };
  
  const toggleMiniMode = async () => { 
    const newMode = !isMiniPlayer; 
    setIsMiniPlayer(newMode); 
    await invoke('set_window_mode', { isMini: newMode }); 
  };
  
  const formatTime = (seconds: number) => { if (isNaN(seconds)) return "0:00"; const mins = Math.floor(seconds / 60); const secs = Math.floor(seconds % 60); return `${mins}:${secs.toString().padStart(2, '0')}`; };

  const renderTrackList = (tracks: Track[], isCachedTab: boolean = false) => (
    <div className="track-list">
      {tracks.map((track, index) => {
        const trackKey = `${track.id}_${track.owner_id}`;
        const downloadKey = `${track.owner_id}_${track.id}`;
        const isCached = !!downloadedTracks[downloadKey];
        const isDownloading = !!downloadingTracks[downloadKey];
        const isLiked = checkIsLiked(track);
        
        return (
          <div 
            key={trackKey} 
            className={`track-item ${currentTrack?.id === track.id ? 'active-track' : ''}`} 
            onClick={() => playTrack(track, tracks)}
          >
            <div className="track-index">{currentTrack?.id === track.id && isPlaying ? '▶' : index + 1}</div>
            
            {track.cover_url ? (
              <img src={track.cover_url} alt="" className="track-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            ) : (
              <div className="track-cover" style={{background: '#333'}}></div>
            )}

            <div className="track-info">
              <div className="track-title">{track.title}</div>
              <div className="track-artist">{track.artist}</div>
            </div>

            {!isOfflineMode && (
              <div className="track-actions">
                <button className="icon-btn" onClick={(e) => { e.stopPropagation(); handleStartRadio(track); }} title="Создать плейлист по треку (Радио)">
                  <IconRadio />
                </button>
                {isDownloading ? (
                  <span className="cache-status downloading">...</span>
                ) : isCached ? (
                  <button className="icon-btn cached-btn" onClick={(e) => deleteCachedTrack(e, track)} title="Удалить из кэша">
                    {isCachedTab ? <IconTrash /> : <IconCheck />}
                  </button>
                ) : (
                  <button className="icon-btn" onClick={(e) => { e.stopPropagation(); downloadTrack(track); }} title="Скачать">
                    <IconDownload />
                  </button>
                )}

                <button className="icon-btn" onClick={(e) => copyTrackName(e, track)} title="Скопировать название">
                  <IconCopy />
                </button>

                <button 
                  className={`icon-btn ${isLiked ? 'added' : ''}`}
                  onClick={(e) => handleToggleFavorite(e, track)}
                  title={isLiked ? "Удалить из моей музыки" : "Добавить в мою музыку"}
                >
                  <IconHeart filled={isLiked} />
                </button>
              </div>
            )}

            <div className="track-duration">{formatTime(track.duration)}</div>
          </div>
        );
      })}
      {tracks.length === 0 && !isFetching && <p className="loading-text">Треки не найдены.</p>}
      {isFetching && tracks.length === 0 && (
        <>
          <TrackSkeleton />
          <TrackSkeleton />
          <TrackSkeleton />
          <TrackSkeleton />
        </>
      )}
      <div ref={loadMoreRef} style={{ height: '10px' }}></div>
    </div>
  );

  if (isLoggedIn === null) return <div className="main-screen"><h1>Загрузка...</h1></div>;

  if (isLoggedIn) {
    return (
      <>
        <audio 
          ref={audioRef} src={currentAudioSrc} 
          onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)} 
          onEnded={handleTrackEnd} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} 
          onError={(e) => {
            console.error("Ошибка воспроизведения:", e);
            if (currentTrack && currentAudioSrc !== currentTrack.url && currentTrack.url) {
              setCurrentAudioSrc(currentTrack.url);
              const trackKey = `${currentTrack.owner_id}_${currentTrack.id}`;
              setDownloadedTracks(prev => {
                const newDownloaded = { ...prev };
                delete newDownloaded[trackKey];
                localStorage.setItem('downloadedTracks', JSON.stringify(newDownloaded));
                return newDownloaded;
              });
            }
          }}
        />

        {isMiniPlayer && currentTrack ? (
          <div className="mini-player">
            <div className="mini-cover" data-tauri-drag-region>
              {currentTrack.cover_url ? <img src={currentTrack.cover_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : <div className="mini-cover-ph">VK</div>}
            </div>
            <div className="mini-info" data-tauri-drag-region>
              <div className="mini-title">{currentTrack.title}</div>
              <div className="mini-artist">{currentTrack.artist}</div>
            </div>
            <div className="mini-controls">
              <button className="ctrl-btn mini-btn" onClick={playPrev}><IconPrev /></button>
              <button className="play-btn mini-play-btn" onClick={togglePlayPause}>{isPlaying ? <IconPause /> : <IconPlay />}</button>
              <button className="ctrl-btn mini-btn" onClick={playNext}><IconNext /></button>
              <button className="ctrl-btn mini-btn expand-btn" onClick={toggleMiniMode}><IconExpand /></button>
            </div>
            
            <div className="mini-bottom">
              <div className="mini-progress-wrapper">
                <span className="time">{formatTime(currentTime)}</span>
                <input type="range" className="progress-bar mini-progress" min="0" max={currentTrack.duration || 0} value={currentTime} onChange={handleSeek} style={{ background: `linear-gradient(to right, var(--accent) ${progressPercent}%, #444 ${progressPercent}%)` }} />
                <span className="time">{formatTime(currentTrack.duration)}</span>
              </div>
              
              <div className="mini-volume-wrapper">
                <span className="vol-icon"><IconVolume /></span>
                <input 
                  type="range" 
                  className="volume-slider mini-volume" 
                  min="0" 
                  max="1" 
                  step="0.01" 
                  value={volume} 
                  onChange={(e) => setVolume(Number(e.target.value))} 
                  style={{ background: `linear-gradient(to top, var(--accent) ${volumePercent}%, #444 ${volumePercent}%)` }} 
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="app-container">
            <header className="header">
              <div className="tabs">
                {!isOfflineMode && (
                  <>
                    <button className={`tab ${activeTab === 'my_music' && !openedPlaylist ? 'active' : ''}`} onClick={() => handleTabChange('my_music')}>Моя музыка</button>
                    <button className={`tab ${activeTab === 'search' && !openedPlaylist ? 'active' : ''}`} onClick={() => handleTabChange('search')}>Поиск</button>
                  </>
                )}
                <button className={`tab ${activeTab === 'cached' && !openedPlaylist ? 'active' : ''}`} onClick={() => handleTabChange('cached')}>Скачанные</button>
                {!isOfflineMode && (
                  <>
                    <button className={`tab ${activeTab === 'playlists' ? 'active' : ''}`} onClick={() => handleTabChange('playlists')}>Плейлисты</button>
                    <button className={`tab ${activeTab === 'vk_mix' ? 'active' : ''}`} onClick={() => handleTabChange('vk_mix')}>VK Mix</button>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn-secondary" onClick={toggleMiniMode} disabled={!currentTrack} style={{ opacity: currentTrack ? 1 : 0.3, cursor: currentTrack ? 'pointer' : 'not-allowed' }}>Мини-плеер</button>
                <button className="btn-secondary" onClick={() => { setIsLoggedIn(false); setMyTracks([]); setMixTracks([]); setUserPlaylists([]); setCurrentTrack(null); setIsPlaying(false); closePlaylist(); setIsOfflineMode(false); }}>Выйти</button>
              </div>
            </header>

            <div className="content-area" style={{ paddingBottom: currentTrack ? '100px' : '10px' }} onScroll={handleScroll} ref={scrollRef}>
              {errorMsg && <div className="error-message">{errorMsg}</div>}

              {openedPlaylist ? (
                <div>
                  <div className="playlist-header">
                    <button className="btn-back" onClick={closePlaylist}>← Назад</button>
                    {openedPlaylist.cover_url && <img src={openedPlaylist.cover_url} alt="" className="playlist-header-cover" />}
                    <h2>{openedPlaylist.title}</h2>
                  </div>
                  {isFetching ? (
                    <div className="track-list">
                      <TrackSkeleton /><TrackSkeleton /><TrackSkeleton />
                    </div>
                  ) : renderTrackList(playlistTracks)}
                </div>
              ) : (
                <>
                  {activeTab === 'cached' && (
                    <div className="cached-tab-content">
                      <div className="tab-header">
                        <h2>Скачанные</h2>
                        {!isOfflineMode && (
                          <button className="btn-secondary" onClick={syncCacheWithMyMusic} title="Найти скачанные треки в Моей музыке">
                            Синхронизировать
                          </button>
                        )}
                      </div>
                      {cachedTracks.length === 0 ? <p className="loading-text">Нет скачанных треков</p> : renderTrackList(cachedTracks, true)}
                    </div>
                  )}

                  {!isOfflineMode && activeTab === 'search' && (
                    <div className="search-container">
                      <form onSubmit={handleSearchSubmit} className="search-form">
                        <input type="text" placeholder="Что будем искать?" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="search-input" />
                        <button type="submit" className="btn-primary" style={{width: '150px', marginTop: 0}}>Найти</button>
                      </form>
                      {isFetching && searchTracks.length === 0 ? (
                        <div className="track-list"><TrackSkeleton /><TrackSkeleton /><TrackSkeleton /></div>
                      ) : renderTrackList(searchTracks)}
                    </div>
                  )}

                  {!isOfflineMode && activeTab === 'my_music' && (
                    <>
                      {renderTrackList(myTracks)}
                    </>
                  )}

                  {!isOfflineMode && activeTab === 'playlists' && (
                    <div className="vk-mix-container">
                       {isFetching && userPlaylists.length === 0 ? <p className="loading-text">Загрузка...</p> : (
                         <>
                           <div className="accordion-header" onClick={() => setIsPlaylistsExpanded(!isPlaylistsExpanded)}>
                             <h2>Мои плейлисты</h2>
                             <IconChevron isOpen={isPlaylistsExpanded} />
                           </div>
                           {isPlaylistsExpanded && (
                             <div className="playlist-grid">
                                {userPlaylists.map(pl => (
                                  <div key={`${pl.id}_${pl.owner_id || 'me'}`} className="playlist-card" onClick={() => openPlaylist(pl)}>
                                    {pl.cover_url ? <img src={pl.cover_url} alt="" className="playlist-cover" /> : <div className="playlist-cover-placeholder" />}
                                    <div className="playlist-title">{pl.title}</div>
                                    <div className="playlist-count">{pl.count} треков</div>
                                  </div>
                                ))}
                             </div>
                           )}
                         </>
                       )}
                    </div>
                  )}

                  {!isOfflineMode && activeTab === 'vk_mix' && (
                    <div className="vk-mix-container">
                      <div className="tab-header">
                        <h2>VK Mix</h2>
                        <button className="btn-refresh" onClick={handleRefreshMix} title="Обновить рекомендации">
                          <IconRefresh />
                        </button>
                      </div>
                      
                      {vkMixError && (
                        <div className="error-message" style={{ marginBottom: '20px' }}>
                          Ошибка: {vkMixError}
                        </div>
                      )}

                      {isVkMixLoading && mixTracks.length === 0 ? (
                         <div className="track-list">
                           <TrackSkeleton /><TrackSkeleton /><TrackSkeleton />
                         </div>
                      ) : (
                        <>
                          {mixPlaylists.length > 0 && (
                            <div className="mix-section">
                              <div className="accordion-header" onClick={() => setIsMixPlaylistsExpanded(!isMixPlaylistsExpanded)}>
                                <h2>Миксы и подборки</h2>
                                <IconChevron isOpen={isMixPlaylistsExpanded} />
                              </div>
                              {isMixPlaylistsExpanded && (
                                <div className="playlist-grid">
                                  {mixPlaylists.map(pl => (
                                    <div key={`${pl.id}_${pl.owner_id || 'mix'}`} className="playlist-card" onClick={() => openPlaylist(pl)}>
                                      {pl.cover_url ? <img src={pl.cover_url} alt="" className="playlist-cover" /> : <div className="playlist-cover-placeholder" />}
                                      <div className="playlist-title">{pl.title}</div>
                                      <div className="playlist-count">{pl.count} треков</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          {mixTracks.length > 0 && (
                            <div className="mix-section">
                              <h2>Для вас</h2>
                              {renderTrackList(mixTracks)}
                            </div>
                          )}
                          {!isVkMixLoading && mixTracks.length === 0 && mixPlaylists.length === 0 && !vkMixError && (
                             <p className="loading-text">Нет рекомендаций. Попробуйте обновить.</p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {currentTrack && (
              <div className="player-bar">
                <div className="player-info">
                  {currentTrack.cover_url && <img src={currentTrack.cover_url} alt="" className="player-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
                  <div className="player-text">
                    <div className="player-title">{currentTrack.title}</div>
                    <div className="player-artist">{currentTrack.artist}</div>
                  </div>
                  {!isOfflineMode && (
                    <button 
                      className={`icon-btn player-icon-btn ${checkIsLiked(currentTrack) ? 'added' : ''}`}
                      onClick={(e) => handleToggleFavorite(e, currentTrack)}
                    >
                      <IconHeart filled={checkIsLiked(currentTrack)} />
                    </button>
                  )}
                </div>
                
                <div className="player-center">
                  <div className="player-controls">
                    <button className={`ctrl-btn ${isShuffle ? 'active-mode' : ''}`} onClick={() => setIsShuffle(!isShuffle)}><IconShuffle /></button>
                    <button className="ctrl-btn" onClick={restartTrack}><IconPrev /></button>
                    <button className="ctrl-btn" onClick={playPrev}><IconPrev /></button>
                    <button className="play-btn" onClick={togglePlayPause}>{isPlaying ? <IconPause /> : <IconPlay />}</button>
                    <button className="ctrl-btn" onClick={playNext}><IconNext /></button>
                    <button className={`ctrl-btn ${repeatMode !== 'none' ? 'active-mode' : ''}`} onClick={toggleRepeatMode}><IconRepeat /></button>
                  </div>
                  <div className="progress-container">
                    <span className="time">{formatTime(currentTime)}</span>
                    <input type="range" className="progress-bar" min="0" max={currentTrack.duration || 0} value={currentTime} onChange={handleSeek} style={{ background: `linear-gradient(to right, var(--accent) ${progressPercent}%, #444 ${progressPercent}%)` }} />
                    <span className="time">{formatTime(currentTrack.duration)}</span>
                  </div>
                </div>

                <div className="player-right">
                  <div className="player-volume">
                    <IconVolume />
                    <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(Number(e.target.value))} style={{ background: `linear-gradient(to right, var(--accent) ${volumePercent}%, #444 ${volumePercent}%)` }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <h1 className="title">Подключение к VK</h1>
        <p className="subtitle">Вставьте ваш токен (vk1.a...)</p>
        <form onSubmit={handleSaveToken} className="login-form">
          <input type="text" placeholder="Токен..." value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} className="input-field" required disabled={isLoading} />
          {errorMsg && <div className="error-message">{errorMsg}</div>}
          <button type="submit" className={`btn-primary ${isLoading ? 'disabled' : ''}`} disabled={isLoading || !tokenInput}>{isLoading ? 'Проверка...' : 'Сохранить'}</button>
        </form>
        
        {cachedTracks.length > 0 && (
          <button type="button" className="btn-secondary" onClick={handleOfflineLogin} style={{ width: '100%', marginTop: '15px' }}>
            Слушать офлайн ({cachedTracks.length} треков)
          </button>
        )}
      </div>
    </div>
  );
}

export default App;