export const handler = async (req) => {
  const { name } = await req.json();
  const data = {
    message: `Hello World ${name}!`,
  };
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
    },
  });
};
