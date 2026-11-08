import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { PERMISSIONS } from '../config/permissions.js';
import { getErrorMessage } from '../services/apiError.js';
import { organizationService } from '../services/organizationService.js';
import { useAuth } from './AuthContext.jsx';

/*
  Organization data + the ACTIVE selection (site > farm > house > flock) for the signed-in user.
  Other modules reuse it:   const { activeFarm, activeHouse, activeFlock } = useFarm();

    data lists   sites, farms, houses, flocks   (only what this user may see, archived included)
    maps         siteById, farmById, houseById, flockById
    active       { siteId, farmId, houseId, flockId } plus activeSite, activeFarm, activeHouse, activeFlock
    options      active records for dropdowns, narrowed by the current selection
    setActive(level, id)  level: 'site' | 'farm' | 'house' | 'flock'; id '' clears that level and below
    refresh()    reload after create/edit/archive
*/
const FarmContext = createContext(null);

const EMPTY_DATA = { company: null, sites: [], farms: [], houses: [], flocks: [] };
const EMPTY_SELECTION = { siteId: '', farmId: '', houseId: '', flockId: '' };
const LEVELS = ['site', 'farm', 'house', 'flock'];
const storageKey = (userId) => `pms.activeOrg.${userId}`;

function loadSelection(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? { ...EMPTY_SELECTION, ...JSON.parse(raw) } : EMPTY_SELECTION;
  } catch {
    return EMPTY_SELECTION;
  }
}

function saveSelection(userId, selection) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(selection));
  } catch {
    // ignore: selection just will not survive a reload
  }
}

const byId = (list) => Object.fromEntries(list.map((item) => [item.id, item]));

// Keeps a saved selection only while every level still exists, is active, and belongs to its parent.
function sanitize(selection, usable) {
  const site = usable.sites.find((x) => x.id === selection.siteId);
  if (!site) return EMPTY_SELECTION;
  const out = { ...EMPTY_SELECTION, siteId: site.id };
  const farm = usable.farms.find((x) => x.id === selection.farmId);
  if (!farm || farm.siteId !== site.id) return out;
  out.farmId = farm.id;
  const house = usable.houses.find((x) => x.id === selection.houseId);
  if (!house || house.farmId !== farm.id) return out;
  out.houseId = house.id;
  const flock = usable.flocks.find((x) => x.id === selection.flockId);
  if (!flock || flock.houseId !== house.id) return out;
  out.flockId = flock.id;
  return out;
}

export function FarmProvider({ children }) {
  const { user, hasPermission } = useAuth();
  const userId = user?.id;
  const role = user?.role;
  const canView = Boolean(user && hasPermission(PERMISSIONS.ORGANIZATION_VIEW));

  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selection, setSelection] = useState(EMPTY_SELECTION);
  const requestRef = useRef(0); // ignores answers that arrive after the user changed or signed out

  const fetchData = useCallback(
    async ({ silent = false } = {}) => {
      if (!userId || !canView) return;
      requestRef.current += 1;
      const requestId = requestRef.current;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const result = await organizationService.getScopedHierarchy({ id: userId, role });
        if (requestId === requestRef.current) setData(result);
      } catch (err) {
        if (requestId === requestRef.current) setError(getErrorMessage(err, 'Could not load the organization.'));
      } finally {
        if (requestId === requestRef.current) setLoading(false);
      }
    },
    [userId, role, canView]
  );

  useEffect(() => {
    if (!userId || !canView) {
      requestRef.current += 1;
      setData(EMPTY_DATA);
      setSelection(EMPTY_SELECTION);
      setError(null);
      setLoading(false);
      return;
    }
    setSelection(loadSelection(userId));
    fetchData();
  }, [userId, canView, fetchData]);

  const maps = useMemo(
    () => ({ siteById: byId(data.sites), farmById: byId(data.farms), houseById: byId(data.houses), flockById: byId(data.flocks) }),
    [data]
  );

  // Records that can be selected: active, and every parent above them active too
  const usable = useMemo(() => {
    const sites = data.sites.filter((x) => x.status === 'active');
    const siteOk = new Set(sites.map((x) => x.id));
    const farms = data.farms.filter((x) => x.status === 'active' && siteOk.has(x.siteId));
    const farmOk = new Set(farms.map((x) => x.id));
    const houses = data.houses.filter((x) => x.status === 'active' && farmOk.has(x.farmId));
    const houseOk = new Set(houses.map((x) => x.id));
    const flocks = data.flocks.filter((x) => x.status === 'active' && houseOk.has(x.houseId));
    return { sites, farms, houses, flocks };
  }, [data]);

  const active = useMemo(() => sanitize(selection, usable), [selection, usable]);

  const options = useMemo(() => {
    const { siteId, farmId, houseId } = active;
    const farmSite = (farmIdValue) => maps.farmById[farmIdValue]?.siteId;
    const houseFarm = (houseIdValue) => maps.houseById[houseIdValue]?.farmId;
    return {
      sites: usable.sites,
      farms: usable.farms.filter((x) => !siteId || x.siteId === siteId),
      houses: usable.houses.filter((x) => (farmId ? x.farmId === farmId : siteId ? farmSite(x.farmId) === siteId : true)),
      flocks: usable.flocks.filter((x) => {
        if (houseId) return x.houseId === houseId;
        if (farmId) return houseFarm(x.houseId) === farmId;
        if (siteId) return farmSite(houseFarm(x.houseId)) === siteId;
        return true;
      }),
    };
  }, [active, usable, maps]);

  const setActive = useCallback(
    (level, id) => {
      let next;
      if (!id) {
        next = { ...active };
        LEVELS.slice(LEVELS.indexOf(level)).forEach((name) => {
          next[`${name}Id`] = '';
        });
      } else {
        // Fill in the parents of the chosen record, then keep deeper picks that still match
        const flock = level === 'flock' ? maps.flockById[id] : null;
        const house = level === 'house' ? maps.houseById[id] : flock ? maps.houseById[flock.houseId] : null;
        const farm = level === 'farm' ? maps.farmById[id] : house ? maps.farmById[house.farmId] : null;
        const siteId = level === 'site' ? id : farm?.siteId;
        next = { siteId: siteId || '', farmId: farm?.id || '', houseId: house?.id || '', flockId: flock?.id || '' };
        if (level === 'site' && active.siteId === id) next = { ...active };
        if (level === 'farm' && active.farmId === id) next = { ...active, siteId: farm.siteId };
        if (level === 'house' && active.houseId === id) next = { ...active, farmId: farm.id, siteId: farm.siteId };
      }
      setSelection(next);
      saveSelection(userId, next);
    },
    [active, maps, userId]
  );

  const clearActive = useCallback(() => {
    setSelection(EMPTY_SELECTION);
    saveSelection(userId, EMPTY_SELECTION);
  }, [userId]);

  const value = useMemo(() => {
    const activeSite = maps.siteById[active.siteId] || null;
    const activeFarm = maps.farmById[active.farmId] || null;
    const activeHouse = maps.houseById[active.houseId] || null;
    const activeFlock = maps.flockById[active.flockId] || null;
    return {
      company: data.company,
      sites: data.sites,
      farms: data.farms,
      houses: data.houses,
      flocks: data.flocks,
      maps,
      loading,
      error,
      reload: () => fetchData(),
      refresh: () => fetchData({ silent: true }),
      active,
      activeSite,
      activeFarm,
      activeHouse,
      activeFlock,
      selectionLabel: [activeSite, activeFarm, activeHouse, activeFlock].filter(Boolean).map((x) => x.name).join(' / '),
      options,
      setActive,
      clearActive,
    };
  }, [data, maps, loading, error, fetchData, active, options, setActive, clearActive]);

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
}

export function useFarm() {
  const context = useContext(FarmContext);
  if (!context) throw new Error('useFarm must be used inside <FarmProvider>');
  return context;
}
