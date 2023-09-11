// `nodes` contain any nodes you add from the graph (dependencies)
// `root` is a reference to this program's root node
// `state` is an object that persists across program updates. Store data here.
import { nodes, root, state } from "membrane";

export const Root = {
  status: () => {
    if (!state.token) {
      return "Invoke `:configure` with your pinecone API key first";
    }
    return `Ready`;
  },
  indexes: async () => ({}),
  tests: () => ({}),
};

export const Tests = {
  testGetDatabases: async () => {
    const databases = await root.indexes.items().$query(`{ status { state } }`);
    return Array.isArray(databases);
  },
};

export const IndexCollection = {
  one: async ({ name }) => {
    const res = await api(
      `controller.${state.environment}.pinecone.io`,
      "GET",
      `databases/${name}`
    );
    return res.json();
  },
  items: async () => {
    const res = await api(
      `controller.${state.environment}.pinecone.io`,
      "GET",
      "databases"
    );
    const data = await res.json();

    const convertedArr = data.map((item) => {
      return { database: { name: item.toLowerCase() } };
    });
    return convertedArr;
  },
  create: async (args) => {
    await api(
      `controller.${state.environment}.pinecone.io`,
      "POST",
      "databases",
      null,
      JSON.stringify(args)
    );
  },
};

export const Index = {
  gref: (_, { obj }) => root.indexes.one({ name: obj.database.name }),
  query: async ({ filter, vector, sparceVector, ...rest }, { self }) => {
    const host = await self.status.host;
    const parsedFilter = filter ? JSON.parse(filter) : null;
    const parsedVector = vector ? JSON.parse(vector) : null;
    const parsedSparceVector = sparceVector ? JSON.parse(sparceVector) : null;

    const requestBody = {
      ...rest,
      filter: parsedFilter,
      vector: parsedVector,
      sparceVector: parsedSparceVector,
    };

    const res = await api(
      host,
      "POST",
      "query",
      null,
      JSON.stringify(requestBody)
    );
    return JSON.stringify(await res.json());
  },
  upsert: async ({ vectors, ...rest }, { self }) => {
    const host = await self.status.host;
    const parsedVectors = vectors ? JSON.parse(vectors) : null;

    const requestBody = {
      ...rest,
      vectors: parsedVectors,
    };

    const res = await api(
      host,
      "POST",
      "vectors/upsert",
      null,
      JSON.stringify(requestBody)
    );
    await res.json();
  },
};

export async function configure({ token, environment }) {
  state.token = token;
  state.environment = environment;
}

async function api(
  endpoint: string,
  method: string,
  path: string,
  query?: any,
  body?: string
) {
  if (query) {
    Object.keys(query).forEach((key) =>
      query[key] === undefined ? delete query[key] : {}
    );
  }
  const querystr =
    query && Object.keys(query).length ? `?${new URLSearchParams(query)}` : "";
  const url = `https://${endpoint}/${path}${querystr}`;
  const req = {
    method,
    body,
    headers: {
      "Api-Key": `${state.token}`,
      accept: "application/json",
      "Content-Type": "application/json",
    },
  };
  const res = await fetch(url, req);
  if (res.status > 299) {
    throw new Error(`Could not fetch ${url}: ${res.text()}`);
  }
  return res;
}
