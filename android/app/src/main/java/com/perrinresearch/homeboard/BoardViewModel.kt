package com.perrinresearch.homeboard

import androidx.lifecycle.ViewModel
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class BoardViewModel : ViewModel() {
    private val repository = HouseholdRepository()
    private val _signedIn = MutableStateFlow(FirebaseAuth.getInstance().currentUser != null)
    val signedIn: StateFlow<Boolean> = _signedIn
    private val _household = MutableStateFlow<Household?>(null)
    val household: StateFlow<Household?> = _household
    private val _error = MutableStateFlow("")
    val error: StateFlow<String> = _error
    private var authListener: FirebaseAuth.AuthStateListener? = null

    init {
        val listener = FirebaseAuth.AuthStateListener { auth ->
            _signedIn.value = auth.currentUser != null
            _error.value = ""
            if (auth.currentUser != null) {
                repository.listen(
                    onHousehold = { _household.value = it },
                    onError = { _error.value = it }
                )
            } else {
                _household.value = null
            }
        }
        authListener = listener
        FirebaseAuth.getInstance().addAuthStateListener(listener)
    }

    fun signIn(email: String, code: String) {
        _error.value = ""
        repository.signIn(email, code) { message ->
            if (message != null) {
                _error.value = message
            }
        }
    }

    fun signOut() {
        repository.signOut()
    }

    fun toggleShopping(item: ShoppingItem) {
        val current = _household.value ?: return
        val next = current.shopping.map {
            if (it.id == item.id) it.copy(checked = !it.checked) else it
        }
        _household.value = current.copy(shopping = next)
        repository.saveShopping(next) { _error.value = it }
    }

    fun addShopping(title: String) {
        val trimmed = title.trim()
        if (trimmed.isEmpty()) {
            return
        }
        val current = _household.value ?: return
        val next = current.shopping + ShoppingItem(
            id = System.currentTimeMillis().toString(),
            title = trimmed,
            quantity = "",
            checked = false
        )
        _household.value = current.copy(shopping = next)
        repository.saveShopping(next) { _error.value = it }
    }

    fun toggleChore(chore: Chore) {
        val current = _household.value ?: return
        val next = current.chores.map {
            if (it.id != chore.id) {
                it
            } else if (it.completed) {
                it.copy(completed = false)
            } else {
                it.completedNext()
            }
        }
        _household.value = current.copy(chores = next)
        repository.saveChores(next) { _error.value = it }
    }

    fun addChore(title: String, memberId: String) {
        val trimmed = title.trim()
        if (trimmed.isEmpty()) {
            return
        }
        val current = _household.value ?: return
        val now = java.time.Instant.now().toString()
        val next = current.chores + Chore(
            id = System.currentTimeMillis().toString(),
            title = trimmed,
            description = "",
            assignedTo = memberId,
            frequency = "weekly",
            frequencyValue = 1,
            completed = false,
            nextDue = now,
            lastCompleted = ""
        )
        _household.value = current.copy(chores = next)
        repository.saveChores(next) { _error.value = it }
    }

    override fun onCleared() {
        authListener?.let { FirebaseAuth.getInstance().removeAuthStateListener(it) }
        repository.stop()
    }
}
