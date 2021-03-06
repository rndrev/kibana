/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { Direction, UsersFields, UsersSortField } from '../../graphql/types';
import { assertUnreachable, createQueryFilterClauses } from '../../utils/build_query';

import { UsersRequestOptions } from './index';

export const buildUsersQuery = ({
  ip,
  usersSortField,
  filterQuery,
  flowTarget,
  pagination: { limit },
  sourceConfiguration: {
    fields: { timestamp },
    auditbeatAlias,
    packetbeatAlias,
    winlogbeatAlias,
  },
  timerange: { from, to },
}: UsersRequestOptions) => {
  const filter = [
    ...createQueryFilterClauses(filterQuery),
    { range: { [timestamp]: { gte: from, lte: to } } },
    { term: { [`${flowTarget}.ip`]: ip } },
  ];

  const dslQuery = {
    allowNoIndices: true,
    index: [auditbeatAlias, packetbeatAlias, winlogbeatAlias],
    ignoreUnavailable: true,
    body: {
      aggs: {
        user_count: {
          cardinality: {
            field: 'user.name',
          },
        },
        users: {
          terms: {
            field: 'user.name',
            size: limit + 1,
            order: {
              ...getQueryOrder(usersSortField),
            },
          },
          aggs: {
            id: {
              terms: {
                field: 'user.id',
              },
            },
            groupId: {
              terms: {
                field: 'user.group.id',
              },
            },
            groupName: {
              terms: {
                field: 'user.group.name',
              },
            },
          },
        },
      },
      query: {
        bool: {
          filter,
          must_not: [
            {
              term: {
                'event.category': 'authentication',
              },
            },
          ],
        },
      },
      size: 0,
      track_total_hits: false,
    },
  };

  return dslQuery;
};

type QueryOrder = { _count: Direction } | { _key: Direction };

const getQueryOrder = (usersSortField: UsersSortField): QueryOrder => {
  switch (usersSortField.field) {
    case UsersFields.name:
      return { _key: usersSortField.direction };
    case UsersFields.count:
      return { _count: usersSortField.direction };
    default:
      return assertUnreachable(usersSortField.field);
  }
};
