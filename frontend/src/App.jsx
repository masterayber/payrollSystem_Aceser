import { useEffect, useState } from "react";
import API from "./api";

const App = () => {
  const [message, setMessage] = useState("");

  useEffect(() => {
    API.get("/")
      .then((res) => setMessage(res.data))
      .catch((err) => console.error(err));
  }, []);

  return <div>{message}</div>;
};

export default App;
