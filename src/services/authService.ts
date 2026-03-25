// Updated authService.ts to prevent infinite recursion in getCurrentUser

const authService = {
    getCurrentUser: function() {
        // logic to get current user, ensuring it doesn't call itself
        const user = this.fetchCurrentUser(); // Example for fetching user data
        return user;
    },
    fetchCurrentUser: function() {
        // Replace with actual logic to fetch user data
        return { id: 1, name: 'John Doe' }; // Dummy user data
    },
};

export default authService;