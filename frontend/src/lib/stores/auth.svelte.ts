export interface UserProfile {
	id: string;
	username: string;
	full_name: string;
	avatar_url: string;
}

class AuthStore {
	isAuthenticated = $state(false);
	userId = $state<string | null>(null);
	username = $state<string | null>(null);

	// Tunda pengambilan role/workspace lebih detail nanti

	setAuth(id: string, uname: string | null = null) {
		this.isAuthenticated = true;
		this.userId = id;
		if (uname) {
			this.username = uname;
		}
	}

	clearAuth() {
		this.isAuthenticated = false;
		this.userId = null;
		this.username = null;
	}
}

export const auth = new AuthStore();
