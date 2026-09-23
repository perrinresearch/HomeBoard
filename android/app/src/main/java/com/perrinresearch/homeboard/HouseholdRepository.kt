package com.perrinresearch.homeboard

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.SetOptions
import java.time.ZonedDateTime

data class Member(val id: String, val name: String, val color: String)

data class ShoppingItem(
    val id: String,
    val title: String,
    val quantity: String,
    val checked: Boolean
)

data class Chore(
    val id: String,
    val title: String,
    val description: String,
    val assignedTo: String,
    val frequency: String,
    val frequencyValue: Int,
    val completed: Boolean,
    val nextDue: String,
    val lastCompleted: String
)

data class Household(
    val members: List<Member>,
    val chores: List<Chore>,
    val shopping: List<ShoppingItem>
)

class HouseholdRepository {
    private val auth: FirebaseAuth = FirebaseAuth.getInstance()
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance()
    private var registration: ListenerRegistration? = null

    fun currentUid(): String? = auth.currentUser?.uid

    fun signIn(email: String, code: String, onDone: (String?) -> Unit) {
        auth.signInWithEmailAndPassword(email.trim(), code.trim())
            .addOnSuccessListener { onDone(null) }
            .addOnFailureListener { onDone(it.message ?: "Could not join the household") }
    }

    fun stop() {
        registration?.remove()
        registration = null
    }

    fun signOut() {
        stop()
        auth.signOut()
    }

    fun listen(onHousehold: (Household) -> Unit, onError: (String) -> Unit) {
        registration?.remove()
        val uid = currentUid() ?: return
        registration = firestore.document("households/$uid")
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    onError(error.message ?: "Could not load the household")
                    return@addSnapshotListener
                }
                val data = snapshot?.data ?: return@addSnapshotListener
                onHousehold(parseHousehold(data))
            }
    }

    fun saveShopping(items: List<ShoppingItem>, onError: (String) -> Unit) {
        val uid = currentUid() ?: return
        firestore.document("households/$uid")
            .set(mapOf("shopping" to items.map { it.toMap() }), SetOptions.merge())
            .addOnFailureListener { onError(it.message ?: "Could not update the shopping list") }
    }

    fun saveChores(items: List<Chore>, onError: (String) -> Unit) {
        val uid = currentUid() ?: return
        firestore.document("households/$uid")
            .set(mapOf("chores" to items.map { it.toMap() }), SetOptions.merge())
            .addOnFailureListener { onError(it.message ?: "Could not update chores") }
    }

    private fun parseHousehold(data: Map<String, Any>): Household {
        return Household(
            members = maps(data["members"]).map { member ->
                Member(
                    id = text(member["id"]),
                    name = text(member["name"]),
                    color = text(member["color"]).ifBlank { "#5561d6" }
                )
            },
            chores = maps(data["chores"]).map { chore ->
                Chore(
                    id = text(chore["id"]),
                    title = text(chore["title"]),
                    description = text(chore["description"]),
                    assignedTo = text(chore["assignedTo"]),
                    frequency = text(chore["frequency"]).ifBlank { "weekly" },
                    frequencyValue = number(chore["frequencyValue"]),
                    completed = chore["completed"] == true,
                    nextDue = text(chore["nextDue"]),
                    lastCompleted = text(chore["lastCompleted"])
                )
            },
            shopping = maps(data["shopping"]).map { item ->
                ShoppingItem(
                    id = text(item["id"]),
                    title = text(item["title"]),
                    quantity = text(item["quantity"]),
                    checked = item["checked"] == true
                )
            }
        )
    }

    private fun maps(value: Any?): List<Map<String, Any?>> {
        val list = value as? List<*> ?: return emptyList()
        return list.mapNotNull { item ->
            @Suppress("UNCHECKED_CAST")
            item as? Map<String, Any?>
        }
    }

    private fun text(value: Any?): String = value?.toString() ?: ""

    private fun number(value: Any?): Int = when (value) {
        is Int -> value
        is Long -> value.toInt()
        is Double -> value.toInt()
        is String -> value.toIntOrNull() ?: 1
        else -> 1
    }
}

fun ShoppingItem.toMap(): Map<String, Any> = mapOf(
    "id" to id,
    "title" to title,
    "quantity" to quantity,
    "checked" to checked
)

fun Chore.toMap(): Map<String, Any> = mapOf(
    "id" to id,
    "title" to title,
    "description" to description,
    "assignedTo" to assignedTo,
    "frequency" to frequency,
    "frequencyValue" to frequencyValue,
    "completed" to completed,
    "nextDue" to nextDue,
    "lastCompleted" to lastCompleted
)

fun Chore.completedNext(): Chore {
    val now = ZonedDateTime.now()
    val step = frequencyValue.coerceAtLeast(1).toLong()
    val next = when (frequency) {
        "daily", "custom" -> now.plusDays(step)
        "weekly" -> now.plusWeeks(step)
        "monthly" -> now.plusMonths(step)
        else -> now.plusWeeks(1)
    }
    return copy(
        completed = true,
        lastCompleted = now.toInstant().toString(),
        nextDue = next.toInstant().toString()
    )
}
