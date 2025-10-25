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
} from '../lib/firestoreData';
import type { Assignment, Developer, Project, Team } from '../types/models';

const DEFAULT_TENANT_ID = import.meta.env.VITE_FIREBASE_DEFAULT_TENANT_ID ?? 'default';

type TenantAwareOptions = {
  tenantId?: string;
  enabled?: boolean;
};

type QueryOptions<TData> = TenantAwareOptions & {
  initialData?: TData;
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
  });

  useEffect(() => {
    if (options.enabled === false) {
      return;
    }
    const unsubscribe = subscribeTeams(tenantId, (teams) => {
      queryClient.setQueryData(queryKey, teams);
    });
    return () => unsubscribe();
  }, [tenantId, options.enabled, queryClient]);

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
  });

  useEffect(() => {
    if (options.enabled === false) {
      return;
    }
    const unsubscribe = subscribeProjects(tenantId, (projects) => {
      queryClient.setQueryData(queryKey, projects);
    });
    return () => unsubscribe();
  }, [tenantId, options.enabled, queryClient]);

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
  });

  useEffect(() => {
    if (options.enabled === false) {
      return;
    }
    const unsubscribe = subscribeDevelopers(tenantId, (developers) => {
      queryClient.setQueryData(queryKey, developers);
    });
    return () => unsubscribe();
  }, [tenantId, options.enabled, queryClient]);

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
  });

  useEffect(() => {
    if (options.enabled === false) {
      return;
    }
    const unsubscribe = subscribeAssignments(tenantId, (assignments) => {
      queryClient.setQueryData(queryKey, assignments);
    });
    return () => unsubscribe();
  }, [tenantId, options.enabled, queryClient]);

  return queryResult;
}
