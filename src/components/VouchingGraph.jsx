// src/components/VouchingGraph.jsx
import React, { useEffect, useRef, useState } from "react";
import { gql, ApolloClient, InMemoryCache } from "@apollo/client";
import { Network } from "vis-network/standalone";
 
// Apollo GraphQL setup with error policies
const client = new ApolloClient({
  uri: "https://api.studio.thegraph.com/query/78581/union-finance/version/latest",
  cache: new InMemoryCache(),
  defaultOptions: {
    query: {
      fetchPolicy: 'network-only',
      errorPolicy: 'all',
    },
  },
});

// Simpler query first to test
const TEST_QUERY = gql`
  {
    _meta {
      block {
        number
      }
    }
  }
`;

const VOUCHING_QUERY = gql`
  {
    trustLines(first: 10) {
      id
      staker
      borrower
    }
  }
`;

const VouchingGraph = () => {
  const containerRef = useRef(null);
  const networkRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const testEndpoint = async () => {
      try {
        console.log("Testing GraphQL endpoint...");
        const result = await client.query({
          query: TEST_QUERY
        });
        console.log("Test query result:", result);
        return true;
      } catch (err) {
        console.error("Test query failed:", err);
        return false;
      }
    };

    const fetchData = async () => {
      try {
        console.log("Starting data fetch process...");
        
        // First test if endpoint is responsive
        const isEndpointWorking = await testEndpoint();
        if (!isEndpointWorking) {
          throw new Error("GraphQL endpoint is not responding correctly");
        }

        // Fetch the actual data
        console.log("Fetching trust lines data...");
        const response = await client.query({
          query: VOUCHING_QUERY
        });

        console.log("GraphQL Response:", response);

        if (response.errors) {
          throw new Error(`GraphQL Errors: ${JSON.stringify(response.errors)}`);
        }

        if (!response.data || !response.data.trustLines) {
          throw new Error("No trust lines data in response");
        }

        const trustLines = response.data.trustLines;
        console.log("Trust lines data:", trustLines);

        if (!mounted) return;

        if (trustLines.length === 0) {
          setError("No trust lines found in the data");
          return;
        }

        // Create the visualization
        const addresses = Array.from(
          new Set(trustLines.flatMap((t) => [t.staker, t.borrower]))
        );

        const nodes = addresses.map((addr) => ({
          id: addr,
          label: addr.slice(0, 8) + "...",
          shape: "dot",
          size: 15,
        }));

        const edges = trustLines.map((line) => ({
          from: line.staker,
          to: line.borrower,
          arrows: "to",
        }));

        console.log("Creating visualization with:", {
          nodes: nodes.length,
          edges: edges.length
        });

        if (containerRef.current) {
          // Clean up existing network if it exists
          if (networkRef.current) {
            networkRef.current.destroy();
          }

          const network = new Network(
            containerRef.current,
            { nodes, edges },
            {
              nodes: {
                font: { size: 14 },
                color: "#333",
              },
              edges: {
                color: "#999",
                arrows: { to: { enabled: true } },
              },
              physics: {
                enabled: true,
                barnesHut: {
                  gravitationalConstant: -2000,
                  centralGravity: 0.3,
                  springLength: 95,
                },
                stabilization: {
                  enabled: true,
                  iterations: 1000,
                },
              },
            }
          );

          networkRef.current = network;

          network.on("stabilizationProgress", (params) => {
            console.log("Stabilization progress:", params.iterations, "/", params.total);
          });

          network.on("stabilizationIterationsDone", () => {
            console.log("Network stabilized");
            setLoading(false);
          });
        }
      } catch (err) {
        console.error("Error in data fetching:", err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      mounted = false;
      if (networkRef.current) {
        networkRef.current.destroy();
      }
    };
  }, []);

  return (
    <div>
      <h2 style={{ textAlign: "center" }}>Union Vouching Graph</h2>
      {error && (
        <div style={{ color: 'red', textAlign: 'center', margin: '10px' }}>
          Error: {error}
        </div>
      )}
      {loading && (
        <div style={{ textAlign: 'center', margin: '10px' }}>
          Loading data...
        </div>
      )}
      <div
        ref={containerRef}
        style={{
          height: "80vh",
          width: "100%",
          border: "1px solid #ccc",
          background: "#ffffff",
        }}
      />
    </div>
  );
};

export default VouchingGraph;
