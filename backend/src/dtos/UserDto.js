const UserDto = user => ({
	id: user._id,
	email: user.email,
	role: user.role,
});

export default UserDto;

