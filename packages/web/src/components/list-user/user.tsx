import React from "react";

export type UserProps = {
  _id: string;
  name: string;
};

interface Props {
  user: UserProps;
}

const User: React.FC<Props> = ({ user }) => {
  return (
    <div className="w-10 h-10 flex flex-col items-center justify-center">
      <div
        className="rounded-full"
        style={{ width: 50, height: 50, background: "purple" }}
      />
      <div className="text-red">{user.name.substring(0, 10)}</div>
    </div>
  );
};

export default User;
