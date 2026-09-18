export interface UserProfile {
	id: string;
	username: string;
	full_name: string;
	avatar_url: string;
}

class AuthStore {
	isAuthenticated = $state(false);
	userId = $state<string | null>(null);
	// Tunda pengambilan role/workspace lebih detail nanti

	setAuth(id: string) {
		this.isAuthenticated = true;
		this.userId = id;
	}

	clearAuth() {
		this.isAuthenticated = false;
		this.userId = null;
	}
}

export const auth = new AuthStore();
