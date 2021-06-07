import { useRouter } from "next/router";
import React, { FunctionComponent, useEffect, useState } from "react";

interface Props {}

const Login: FunctionComponent<Props> = ({}) => {
  const [values, setValues] = useState({ username: "", room: "" });
  const router = useRouter();

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const myParam = urlParams.get("room");
  }, []);

  const submit = (e) => {
    e.preventDefault();
    router.push(`/room/${values.room}`);
  };

  const handleOnChange = (e) => {
    setValues({ ...values, [e.target.name]: e.target.value });
  };

  return (
    <div className="login">
      <form
        style={{ display: "flex", flexDirection: "column" }}
        onSubmit={submit}
      >
        <input
          name="room"
          placeholder="room's name"
          onChange={handleOnChange}
        />
        <input
          name="username"
          placeholder="username"
          onChange={handleOnChange}
        />

        <button type="submit">Submit</button>
      </form>
    </div>
  );
};

export default Login;
