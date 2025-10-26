import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAssignments,
  fetchDevelopers,
  fetchProjects,
  fetchTeams,
  subscribeAssignments,
  subscribeDevelopers,
  subscribeProjects,
  subscribeTeams,
} from '../lib/firestoreData.ts';
import type { Assignment, Developer, Project, Team } from '../types/models';

const DEFAULT_TENANT_ID = import.meta.env.VITE_FIREBASE_DEFAULT_TENANT_ID ?? 'default';

type TenantAwareOptions = {
  tenantId?: string;
  enabled?: boolean;
};

type QueryOptions<TData> = TenantAwareOptions & {
  initialData?: TData;
  refetchInterval?: number | false;
};

function resolveTenantId(tenantId?: string) {
  return tenantId && tenantId.trim().length > 0 ? tenantId : DEFAULT_TENANT_ID;
}

export function useTenantTeams(options: QueryOptions<Team[]> = {}) {
  const tenantId = resolveTenantId(options.tenantId);
  const queryClient = useQueryClient();
  const queryKey = ['tenant', tenantId, 'teams'];

  const queryResult = useQuery<Team[]>({
    queryKey,
    queryFn: () => fetchTeams(tenantId),
    initialData: options.initialData ?? [],
    enabled: options.enabled ?? true,
    refetchInterval: options.refetchInterval,
  });

  useEffect(() => {
    if (options.enabled === false) {
      return;
    }
    const unsubscribe = subscribeTeams(tenantId, (teams) => {
      console.log('Firestore update: received', teams.length, 'teams');
      queryClient.setQueryData(queryKey, teams);
    });
    return () => unsubscribe();
  }, [tenantId, options.enabled, queryClient, queryKey]);

  return queryResult;
}

export function useTenantProjects(options: QueryOptions<Project[]> = {}) {
  const tenantId = resolveTenantId(options.tenantId);
  const queryClient = useQueryClient();
  const queryKey = ['tenant', tenantId, 'projects'];

  const queryResult = useQuery<Project[]>({
    queryKey,
    queryFn: () => fetchProjects(tenantId),
    initialData: options.initialData ?? [],
    enabled: options.enabled ?? true,
    refetchInterval: options.refetchInterval,
  });

  useEffect(() => {
    if (options.enabled === false) {
      return;
    }
    const unsubscribe = subscribeProjects(tenantId, (projects) => {
      console.log('Firestore update: received', projects.length, 'projects');
      queryClient.setQueryData(queryKey, projects);
    });
    return () => unsubscribe();
  }, [tenantId, options.enabled, queryClient, queryKey]);

  return queryResult;
}

export function useTenantDevelopers(options: QueryOptions<Developer[]> = {}) {
  const tenantId = resolveTenantId(options.tenantId);
  const queryClient = useQueryClient();
  const queryKey = ['tenant', tenantId, 'developers'];

  const queryResult = useQuery<Developer[]>({
    queryKey,
    queryFn: () => fetchDevelopers(tenantId),
    initialData: options.initialData ?? [],
    enabled: options.enabled ?? true,
    refetchInterval: options.refetchInterval,
  });

  useEffect(() => {
    if (options.enabled === false) {
      return;
    }
    const unsubscribe = subscribeDevelopers(tenantId, (developers) => {
      console.log('Firestore update: received', developers.length, 'developers');
      queryClient.setQueryData(queryKey, developers);
    });
    return () => unsubscribe();
  }, [tenantId, options.enabled, queryClient, queryKey]);

  return queryResult;
}

export function useTenantAssignments(options: QueryOptions<Assignment[]> = {}) {
  const tenantId = resolveTenantId(options.tenantId);
  const queryClient = useQueryClient();
  const queryKey = ['tenant', tenantId, 'assignments'];

  const queryResult = useQuery<Assignment[]>({
    queryKey,
    queryFn: () => fetchAssignments(tenantId),
    initialData: options.initialData ?? [],
    enabled: options.enabled ?? true,
    refetchInterval: options.refetchInterval,
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't cache data (formerly cacheTime)
  });

  useEffect(() => {
    if (options.enabled === false) {
      return;
    }
    const unsubscribe = subscribeAssignments(tenantId, (assignments) => {
      console.log('Firestore update: received', assignments.length, 'assignments');
      console.log('Assignment IDs:', assignments.map(a => a.id));
      queryClient.setQueryData(queryKey, assignments);
    });
    return () => unsubscribe();
  }, [tenantId, options.enabled, queryClient, queryKey]);

  return queryResult;
}
