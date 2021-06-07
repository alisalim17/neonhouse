import React, { FunctionComponent } from "react";
import User, { UserProps } from "./user";

interface Props {
  className?: string;
  visible?: boolean;
  placement?: "left" | "top" | "right" | "bottom";
  users: UserProps[];
}

const Users: FunctionComponent<Props> = ({
  className,
  visible = false,
  placement = "left",
  users,
}) => {
  return (
    <div className="flex">
      {users.map((user) => (
        <User user={user} key={user._id} />
      ))}
    </div>
  );
};

export default Users;
